import 'server-only';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import type { ClaimItem } from '@/types/claims';
import { AppError } from '@/utils/errors';
import { ITEM_IMAGE_MAX_BYTES, itemImagePath } from '../utils/image';
import { unwrapRpc, type RpcResult } from './claimSession.service';

export type ItemInput = {
  title: string;
  price_cents: number;
  is_preview: boolean;
  category: string;
  attributes: Record<string, unknown>;
  /** Nota del vendedor (nombre, fecha…), fuera de la imagen. `undefined` en `update` = no cambiarla. */
  seller_note?: string | null;
};

const BUCKET = 'item-images';

async function nextPosition(sessionId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('claim_items')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

export const claimItemService = {
  /** Artículo del evento cuya imagen vive en `path` (idempotencia de las subidas del modo escáner). */
  async findByImagePath(sessionId: string, path: string): Promise<ClaimItem | null> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('claim_items')
      .select('*')
      .eq('session_id', sessionId)
      .eq('image_path', path)
      .maybeSingle();
    return data;
  },

  /** Sube el WebP ya redimensionado a `{user_id}/{session_id}/{uuid}.webp` y devuelve la ruta. */
  async uploadImage(
    userId: string,
    sessionId: string,
    file: File,
    imageId: string = randomUUID(),
  ): Promise<string> {
    if (file.type !== 'image/webp') throw new AppError('image_type', 'Formato no permitido');
    if (file.size === 0 || file.size > ITEM_IMAGE_MAX_BYTES)
      throw new AppError('image_size', 'Imagen demasiado pesada');
    const supabase = await createClient();
    const path = itemImagePath(userId, sessionId, imageId);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: 'image/webp', upsert: false });
    // Con un id fijo (modo escáner) un reintento puede encontrar el objeto ya subido: es el mismo archivo.
    if (error && !/already exists|duplicate/i.test(error.message))
      throw new AppError('image_failed', 'No se pudo subir la imagen', error);
    return path;
  },

  async removeImage(userId: string, path: string | null): Promise<void> {
    // Solo objetos propios: la ruta viene de la BD, pero no se confía a ciegas.
    if (!path || !path.startsWith(`${userId}/`)) return;
    const supabase = await createClient();
    await supabase.storage.from(BUCKET).remove([path]);
  },

  async create(
    userId: string,
    sessionId: string,
    input: ItemInput,
    image: File | null,
    imageId?: string,
  ): Promise<ClaimItem> {
    const supabase = await createClient();
    const imagePath = image ? await this.uploadImage(userId, sessionId, image, imageId) : null;
    // Varias subidas en paralelo (modo escáner) pueden pedir la misma posición: se reintenta con la siguiente.
    let data: ClaimItem | null = null;
    let error: { code?: string } | null = null;
    for (let attempt = 0; attempt < 4 && !data; attempt += 1) {
      ({ data, error } = await supabase
        .from('claim_items')
        .insert({
          session_id: sessionId,
          position: await nextPosition(sessionId),
          title: input.title,
          price_cents: input.price_cents,
          is_preview: input.is_preview,
          category: input.category,
          attributes: input.attributes as never,
          seller_note: input.seller_note ?? null,
          image_path: imagePath,
        })
        .select('*')
        .single());
      if (error && error.code !== '23505') break;
    }
    if (error || !data) {
      await this.removeImage(userId, imagePath);
      throw new AppError('save_failed', 'No se pudo guardar el artículo', error);
    }
    return data;
  },

  /** Actualiza el artículo; si llega imagen nueva, la reemplaza y borra el objeto anterior. */
  async update(
    userId: string,
    itemId: string,
    input: Omit<ItemInput, 'category'>,
    image: File | null,
  ): Promise<void> {
    const supabase = await createClient();
    const { data: current } = await supabase
      .from('claim_items')
      .select('session_id, image_path')
      .eq('id', itemId)
      .maybeSingle();
    if (!current) throw new AppError('not_found', 'Artículo no encontrado');

    const newPath = image ? await this.uploadImage(userId, current.session_id, image) : null;
    const { data, error } = await supabase
      .from('claim_items')
      .update({
        title: input.title,
        price_cents: input.price_cents,
        is_preview: input.is_preview,
        attributes: input.attributes as never,
        ...(input.seller_note !== undefined ? { seller_note: input.seller_note } : {}),
        ...(newPath ? { image_path: newPath } : {}),
      })
      .eq('id', itemId)
      .select('id');
    if (error || !data?.length) {
      await this.removeImage(userId, newPath);
      throw new AppError('save_failed', 'No se pudo guardar el artículo', error);
    }
    if (newPath) await this.removeImage(userId, current.image_path);
  },

  async remove(userId: string, itemId: string): Promise<void> {
    const supabase = await createClient();
    const { data: current } = await supabase
      .from('claim_items')
      .select('image_path')
      .eq('id', itemId)
      .maybeSingle();
    if (!current) throw new AppError('not_found', 'Artículo no encontrado');
    const { data, error } = await supabase
      .from('claim_items')
      .delete()
      .eq('id', itemId)
      .select('id');
    if (error || !data?.length)
      throw new AppError('save_failed', 'No se pudo eliminar el artículo', error);
    await this.removeImage(userId, current.image_path);
  },

  /** Copia el artículo al final de la lista; la imagen se copia en Storage para no compartir objeto. */
  async duplicate(userId: string, itemId: string): Promise<ClaimItem> {
    const supabase = await createClient();
    const { data: source } = await supabase
      .from('claim_items')
      .select('*')
      .eq('id', itemId)
      .maybeSingle();
    if (!source) throw new AppError('not_found', 'Artículo no encontrado');

    let imagePath: string | null = null;
    if (source.image_path?.startsWith(`${userId}/`)) {
      imagePath = itemImagePath(userId, source.session_id, randomUUID());
      const { error } = await supabase.storage.from(BUCKET).copy(source.image_path, imagePath);
      if (error) throw new AppError('image_failed', 'No se pudo copiar la imagen', error);
    }
    const { data, error } = await supabase
      .from('claim_items')
      .insert({
        session_id: source.session_id,
        position: await nextPosition(source.session_id),
        title: source.title,
        price_cents: source.price_cents,
        is_preview: source.is_preview,
        category: source.category,
        attributes: source.attributes,
        seller_note: source.seller_note,
        image_path: imagePath,
      })
      .select('*')
      .single();
    if (error || !data) {
      await this.removeImage(userId, imagePath);
      throw new AppError('save_failed', 'No se pudo duplicar el artículo', error);
    }
    return data;
  },

  /** RPC `reorder_items`: atómica; el arreglo debe contener exactamente los artículos del evento. */
  async reorder(sessionId: string, orderedIds: string[]): Promise<void> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('reorder_items', {
      p_session_id: sessionId,
      p_ordered_ids: orderedIds,
    });
    unwrapRpc(data as RpcResult | null, error);
  },
};

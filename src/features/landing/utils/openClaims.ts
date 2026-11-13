import type { OpenClaim } from '../types';

export const MAX_OPEN_CLAIMS = 6;
export const MAX_SAMPLE_PHOTOS = 4;

type ClaimRow = {
  id: string;
  code: string;
  title: string;
  status: string;
  starts_at: string;
  shop_name: string;
  handle: string | null;
  item_count: number | null;
};
type PhotoRow = { session_id: string; image_path: string | null; position: number };

/**
 * Une los claims con sus fotos de muestra. Solo `live` y `scheduled`, ordenados por hora de inicio (sin
 * destacados ni prioridades), máximo `MAX_OPEN_CLAIMS` y hasta `MAX_SAMPLE_PHOTOS` fotos por claim.
 */
export function buildOpenClaims(claims: ClaimRow[], photos: PhotoRow[]): OpenClaim[] {
  return claims
    .filter((row) => row.status === 'live' || row.status === 'scheduled')
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .slice(0, MAX_OPEN_CLAIMS)
    .map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      status: row.status as OpenClaim['status'],
      startsAt: row.starts_at,
      shopName: row.shop_name,
      handle: row.handle,
      itemCount: row.item_count ?? 0,
      photos: photos
        .filter((photo) => photo.session_id === row.id && photo.image_path)
        .sort((a, b) => a.position - b.position)
        .slice(0, MAX_SAMPLE_PHOTOS)
        .map((photo) => photo.image_path as string),
    }));
}

// Config de lint SOLO para los fixtures de fronteras (ver tests/unit/boundaries.test.ts).
import { defineConfig } from 'eslint/config';
import nextTs from 'eslint-config-next/typescript';
import { boundariesConfig } from '../../eslint.boundaries.mjs';

export default defineConfig([...nextTs, ...boundariesConfig]);

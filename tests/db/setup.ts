import { afterAll } from 'vitest';
import { loadTestEnv } from '../helpers/env';
import { deleteCreatedTestUsers } from '../helpers/users';

loadTestEnv();

// Todo test:db limpia lo que creó, aunque falle.
afterAll(async () => {
  await deleteCreatedTestUsers();
});

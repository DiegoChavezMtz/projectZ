// Props de una page de App Router que lee `searchParams`.
export type SearchParamsProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

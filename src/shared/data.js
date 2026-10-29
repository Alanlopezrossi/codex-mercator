// Layout of the data files in dist/data/{version}/. Shared by the build, the Worker and the browser.
export const SHARD_SIZE = 32;
export const shardOf = (id) => Math.floor(Number(id) / SHARD_SIZE);
export const shardPath = (dataVersion, id) => `/data/${dataVersion}/items/${shardOf(id)}.json`;

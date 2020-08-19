import LRU from 'lru-cache';
import * as _ from 'underscore';
import { RenderResult } from './renderPage';
import { CompleteTestGroupAllocation, RelevantTestGroupAllocation } from '../../../lib/abTestImpl';

const maxPageCacheSizeBytes = 32*1024*1024; //32MB
const maxCacheAgeMs = 90*1000;

const pageCache = new LRU<string,RenderResult>({
  max: maxPageCacheSizeBytes,
  length: (page,key) => JSON.stringify(page).length + JSON.stringify(key).length,
  maxAge: maxCacheAgeMs,
  updateAgeOnGet: false,
  dispose: (key: string, page) => {
    const parsedKey: {cacheKey: string, abTestGroups: RelevantTestGroupAllocation} = JSON.parse(key);
    const { cacheKey, abTestGroups } = parsedKey;
    removeCacheABtest(cacheKey, abTestGroups);
  },
});

const cachedABtestsIndex: Record<string,Array<RelevantTestGroupAllocation>> = {};

export const cacheKeyFromReq = (req): string => {
  if (req.cookies && req.cookies.timezone)
    return `${req.url.path}&timezone=${req.cookies.timezone}`
  else
    return req.url.path
}

// Serve a page from cache, or render it if necessary. Takes a set of A/B test
// groups for this request, which covers *all* A/B tests (including ones that
// may not be relevant to the request).
export const cachedPageRender = async (req, abTestGroups, renderFn) => {
  const cacheKey = cacheKeyFromReq(req);
  const cached = cacheLookup(cacheKey, abTestGroups);
  
  // If already cached, return the cached version
  if (cached) {
    recordCacheHit();
    //eslint-disable-next-line no-console
    console.log(`Serving ${req.url.path} from cache; hit rate=${getCacheHitRate()}`);
    return {
      ...cached,
      cached: true
    };
  } else {
    recordCacheMiss();
    //eslint-disable-next-line no-console
    console.log(`Rendering ${req.url.path} (not in cache; hit rate=${getCacheHitRate()})`);
    
    const renderPromise = renderFn(req);
    const rendered = await renderPromise;
    cacheStore(cacheKey, rendered.abTestGroups, rendered);
    return {
      ...rendered,
      cached: false
    };
  }
}


const cacheLookup = (cacheKey: string, abTestGroups: CompleteTestGroupAllocation): RenderResult|null|undefined => {
  if (!(cacheKey in cachedABtestsIndex))
    return null;
  const abTestCombinations: Array<RelevantTestGroupAllocation> = cachedABtestsIndex[cacheKey];
  for (let i=0; i<abTestCombinations.length; i++) {
    if (objIsSubset(abTestCombinations[i], abTestGroups)) {
      return pageCache.get(JSON.stringify({
        cacheKey: cacheKey,
        abTestGroups: abTestCombinations[i]
      }));
    }
  }
}

const objIsSubset = (subset,superset): boolean => {
  for (let key in subset) {
    if (!(key in superset) || subset[key] !== superset[key])
      return false;
  }
  return true;
}

const cacheStore = (cacheKey: string, abTestGroups: RelevantTestGroupAllocation, rendered: RenderResult): void => {
  if (!cacheLookup(cacheKey, abTestGroups)) {
    if (cacheKey in cachedABtestsIndex)
      cachedABtestsIndex[cacheKey].push(abTestGroups);
    else
      cachedABtestsIndex[cacheKey] = [abTestGroups];
  }
  
  pageCache.set(JSON.stringify({
    cacheKey: cacheKey,
    abTestGroups: abTestGroups
  }), rendered);
}

const removeCacheABtest = (cacheKey: string, abTestGroups: RelevantTestGroupAllocation) => {
  cachedABtestsIndex[cacheKey] = _.filter(cachedABtestsIndex[cacheKey],
    g=>!_.isEqual(g, abTestGroups));
};

let cacheHits = 0;
let cacheQueriesTotal = 0;

export function recordCacheHit() {
  cacheHits++;
  cacheQueriesTotal++;
}
export function recordCacheMiss() {
  cacheQueriesTotal++;
}
export function recordCacheBypass() {
  cacheQueriesTotal++;
}
export function getCacheHitRate() {
  return cacheHits / cacheQueriesTotal;
}

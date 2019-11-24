/* eslint-disable camelcase */
import axios from 'axios';
import https from 'https';
import { JsonRpc } from 'eosjs';
import fetch from 'node-fetch'; // node only; not needed in browsers

interface ProducerInfo {
  owner: string;
  total_votes: string;
  producer_key: string;
  is_active: boolean;
  url: string;
  unpaid_blocks: number;
  last_claim_time: string;
  location: number;
}

interface BpLocation {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface BpNode {
  location: BpLocation;
  node_type: string;
  api_endpoint?: string;
  ssl_endpoint?: string;
  p2p_endpoint?: string;
}

interface BpJson {
  producer_account_name: string;
  producer_public_key: string;
  org: {
    [key: string]: any;
  };
  nodes: BpNode[];
}

const EOS_CHAIN_ID = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';

const TEST_TRANSACTION_ID = '596e905f4af9e212aa4683fa209bfb32d1339e869a16b9c0687d4b7fa1ba7c02';
const BLOCK_NUM = 91463041;

const BP_SEEDS = [
  'https://mainnet.meet.one',
  'https://eos.infstones.io',
  'https://eos.eoscafeblock.com',
  'http://peer1.eoshuobipool.com:8181',
  'https://eos.newdex.one',
  'https://node.betdice.one',
  'https://api.redpacketeos.com',
  'https://api.eoseoul.io',
  'https://eos.infstones.io',
  'https://api.eossweden.org',
  'https://api-mainnet.starteos.io',
  'https://mainnet.eoscannon.io',
  'https://api.eossweden.org',
  'https://api.main.alohaeos.com',
  'https://bp.whaleex.com',
  'https://api.helloeos.com.cn',
  'https://api.eosn.io',
  'https://api.zbeos.com',
  'https://api.eosrio.io',
  'https://api.eoslaomao.com',
  'https://api.eosbeijing.one',
];

async function getProducers(): Promise<ProducerInfo[]> {
  for (let i = 0; i < BP_SEEDS.length; i += 1) {
    try {
      const rpc = new JsonRpc(BP_SEEDS[i], { fetch: fetch as any });
      // eslint-disable-next-line no-await-in-loop
      const response = await rpc.get_producers(true);
      const producers = (response.rows as ProducerInfo[]).filter(p => p.is_active);
      return producers;
    } catch (e) {
      // console.error(e);
    }
  }
  throw new Error(`getProducers() failed after trying all BP seeds`);
}

/**
 * Get a BP's API endpoints.
 *
 * @param url Bp url
 * @returns A list of endpoints, empty if none or error
 */
async function getBpApiEndpoints(url: string): Promise<string[]> {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  });
  const bpJsonUrl = url.endsWith('/') ? `${url}bp.json` : `${url}/bp.json`;

  try {
    const response = await axios.get(bpJsonUrl, {
      httpsAgent: agent,
      timeout: 5000, // 5 seconds
    });
    if (
      response.status !== 200 ||
      response.statusText !== 'OK' ||
      response.headers['content-type'] !== 'application/json'
    ) {
      return [];
    }

    const bpJson = response.data as BpJson;
    const httpEndpoints = bpJson.nodes.filter(n => n.api_endpoint).map(n => n.api_endpoint!);
    const httpsEndpoints = bpJson.nodes.filter(n => n.ssl_endpoint).map(n => n.ssl_endpoint!);
    return httpEndpoints.concat(httpsEndpoints);
  } catch (e) {
    return [];
  }
}

/**
 * Check the validity of an API endpoint.
 *
 * @param url The API endpoint
 * @return latency in milliseconds, 0 means invalid
 */
async function check(url: string): Promise<number> {
  try {
    const startTime = Date.now();

    const rpc = new JsonRpc(url, { fetch: fetch as any });
    const response = await rpc.get_info();
    if (response.chain_id !== EOS_CHAIN_ID) return 0;

    const balanceInfo = (await rpc.get_currency_balance(
      'eidosonecoin',
      'cryptoforest',
      'EIDOS',
    )) as string[];
    if (balanceInfo.length < 1) return 0;

    const transaction = await rpc.history_get_transaction(TEST_TRANSACTION_ID, BLOCK_NUM);
    const endTime = Date.now();
    const latency = Math.round((endTime - startTime) / 3);
    return transaction.id || transaction.transaction_id ? latency : 0;
  } catch (e) {
    // console.error(url);
    // console.error(e);
    return 0;
  }
}

/**
 * Get a list of valid API endpoints.
 *
 * @returns A list of API endpoints, empty if none
 */
export default async function getApiEndpoints(): Promise<Array<{ url: string; latency: number }>> {
  const producers = await getProducers();
  const requests: Promise<string[]>[] = [];
  producers.forEach(p => {
    requests.push(getBpApiEndpoints(p.url));
  });
  // Now that all the asynchronous operations are running, here we wait until they all complete.
  const results = await Promise.all(requests);
  const endpoints = [...new Set(results.flatMap(x => x).concat(BP_SEEDS))];

  const validationRequests: Promise<number>[] = [];
  endpoints.forEach(url => {
    validationRequests.push(check(url));
  });
  const latencyArray = await Promise.all(validationRequests);

  const validEndpoints: Array<{ url: string; latency: number }> = [];
  for (let i = 0; i < latencyArray.length; i += 1) {
    if (latencyArray[i]) {
      validEndpoints.push({ url: endpoints[i], latency: latencyArray[i] });
    }
  }
  return validEndpoints.sort((x, y) => x.latency - y.latency);
}

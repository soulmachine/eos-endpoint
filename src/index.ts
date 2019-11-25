/* eslint-disable camelcase */
import axios from 'axios';
import https from 'https';

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
  'http://eos.infstones.io',
  'https://eos.infstones.io',
  'http://eos.eoscafeblock.com',
  'https://eos.eoscafeblock.com',
  'https://node.betdice.one',
  'http://api.main.alohaeos.com',
  'http://api-mainnet.starteos.io',
  'https://bp.whaleex.com',
  'https://api.zbeos.com',
  'https://node1.zbeos.com',
  'https://api.main.alohaeos.com',
  'https://api.eoslaomao.com',
  'https://api-mainnet.starteos.io',
  'http://peer2.eoshuobipool.com:8181',
  'http://peer1.eoshuobipool.com:8181',
  'https://api.redpacketeos.com',
  'https://mainnet.eoscannon.io',
];

async function post(url: string, data: { [key: string]: any }): Promise<any> {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  });
  const response = await axios.post(url, data, {
    httpsAgent: agent,
    timeout: 5000, // 5 seconds
  });
  if (
    response.status !== 200 ||
    response.statusText !== 'OK' ||
    !(response.headers['content-type'] as string).startsWith('application/json')
  ) {
    throw new Error('Malformed response');
  }
  return response.data;
}

async function getProducers(): Promise<ProducerInfo[]> {
  for (let i = 0; i < BP_SEEDS.length; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const data = await post(`${BP_SEEDS[i]}/v1/chain/get_producers`, {
        json: true,
        lower_bound: '',
        limit: 50,
      });
      const producers = (data.rows as ProducerInfo[]).filter(p => p.is_active);
      return producers;
    } catch (e) {
      // console.error(BP_SEEDS[i]);
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
      !(response.headers['content-type'] as string).startsWith('application/json')
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

    const response = await post(`${url}/v1/chain/get_info`, {});
    if (response.chain_id !== EOS_CHAIN_ID) return 0;

    const balanceInfo = (await post(`${url}/v1/chain/get_currency_balance`, {
      code: 'eidosonecoin',
      account: 'cryptoforest',
      symbol: 'EIDOS',
    })) as string[];
    if (balanceInfo.length < 1) return 0;

    const transaction = await post(`${url}/v1/history/get_transaction`, {
      id: TEST_TRANSACTION_ID,
      block_num_hint: BLOCK_NUM,
    });
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

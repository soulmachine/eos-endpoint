# eos-endpoint

Get a list of valid EOS API endpoints.

[![NPM](https://nodei.co/npm/eos-endpoint.png?downloads=true&downloadRank=true)](https://nodei.co/npm/eos-endpoint/)

## How to use

```javascript
const getApiEndpoints = require('eos-endpoint').default; // eslint-disable-line import/no-unresolved

(async () => {
  const endpoints = await getApiEndpoints();
  console.info(endpoints);
})();
```

## Quickstart

```bash
npx eos-endpoint
```

## References

- [API endpoints :: EOSDocs.io](https://www.eosdocs.io/resources/apiendpoints/)
- [EOS Network Monitor](https://eosnetworkmonitor.io/)

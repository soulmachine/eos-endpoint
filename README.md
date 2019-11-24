# eos-endpoint

Get a list of valid EOS API endpoints.

## How to use

```javascript
const getApiEndpoints = require('eos-endpoint'); // eslint-disable-line import/no-unresolved

(async () => {
  const endpoints = await getApiEndpoints();
  console.info(endpoints);
})();
```

## Quickstart

```bash
npx eos-endpoints
```

## References

- [API endpoints :: EOSDocs.io](https://www.eosdocs.io/resources/apiendpoints/)
- [EOS Network Monitor](https://eosnetworkmonitor.io/)

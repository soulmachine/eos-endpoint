#!/usr/bin/env node
/* eslint-disable no-console */
import getApiEndpoints from './index';

(async () => {
  console.info('Retrieving a list of valid EOS API endpoints...\n\n');
  const endpoints = await getApiEndpoints();
  console.info(endpoints);
})();

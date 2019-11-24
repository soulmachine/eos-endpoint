#!/usr/bin/env node
/* eslint-disable no-console */
import getApiEndpoints from './index';

(async () => {
  const endpoints = await getApiEndpoints();
  console.info(endpoints);
})();

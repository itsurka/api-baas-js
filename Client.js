const axios = require('axios');
const sha256 = require('js-sha256').sha256;
const queryString = require('query-string');
const crypto = require('crypto');
const _ = require('lodash/core');


module.exports = class Client
{
  constructor(partnerId, token) {
    this.partnerId = partnerId;
    this.token = token;
    this.baseUrl = `https://baas_test.talkbank.io/api/v1`;
    this.config = {
      method: "",
      url: "",
      headers: {
        Authorization: "",
        date: "",
        host: 'baas_test.talkbank.io',
        'Content-Type': 'application/json'
      },
    };
  }

  // Create signature using HMAC.
  getSignature (config, query, url) {
    // Create hmac instance from your token
    const hmac = crypto.createHmac("sha256", this.token);

    // Join white list headers (date, tb-content-sha256) into a single string
    const headers = config.headers;
    const header = [
      `date:${headers.date}`.trim(),
      `tb-content-sha256:${headers['tb-content-sha256']}`.trim()
    ];
    const headerString = header.join('\n');

    // Create a string from hmac encoding
    let string = `${config.method.toUpperCase()}\n`;
    string = `${string}/api/v1${url.trim()}\n${query.trim()}\n${headerString.trim()}\n${headers['tb-content-sha256'].trim()}`;

    hmac.write(string);
    hmac.end();

    // Return Authorization header signature
    const signature = hmac.read().toString('hex');
    return `TB1-HMAC-SHA256 ${this.partnerId}:${signature}`;
  }

  // Create axios request. Url = '', data = {}
  createRequest(url, method = 'GET', data=null, query='') {
    query = queryString.stringify(query);
    const config = _.clone(this.config);
    config.url = `${this.baseUrl}${url}?${query}`;
    if (method === 'POST' || method === 'PUT'){
      data = JSON.stringify(data);
      config.data = data;
    }
    console.log(config.data)

    config.method = method;
    config.headers.date = new Date().toUTCString();
    config.headers['tb-content-sha256'] = method === 'POST' || method === 'PUT' ? sha256(data) : sha256('');
    config.headers.Authorization = this.getSignature(config, query, url);

    return axios(config);
  }

  // Account Methods
  // Get account balance from bank
  getAccountBalance () {
      return this.createRequest('/balance', 'GET');
  }

  // Transactions history from the bank account.
  // Datetime with timezone
  getAccountHistory (dateFrom = null, dateTo = null, bank = null, limit = null, page = null) {
    const query = {};
    if (bank)     data.bank = bank;
    if (limit)    data.limit = limit;
    if (page)     data.page = page;
    if (dateFrom) data.dateFrom = dateFrom;
    if (dateTo)   data.dateTo = dateTo;
    return this.createRequest('/transactions', 'GET', null, query);
  }

  // Card Methods
  // Get card balance. ean = 2000005399862
  getCardBalance (clientId, ean) {
    return this.createRequest(`/clients/${clientId}/cards/${ean}/balance`);
  }

  // Get card history. ean = 2000005399862
  // Datetime with timezone
  getCardHistory (clientId, ean, dateFrom=null, dateTo=null, limit = null, page = null) {
    const query = {};
    if (limit)    data.limit = limit;
    if (page)     data.page = page;
    if (dateFrom) data.dateFrom = dateFrom;
    if (dateTo)   data.dateTo = dateTo;
    return this.createRequest(`/clients/${clientId}/cards/${ean}/transactions`, 'GET', null, query);
  }

  // Block a card. Reason is optional
  blockCard (clientId, ean, reason = null) {
    const data = {};
    if (reason) {data.reason = reason}
    return this.createRequest(`/clients/${clientId}/cards/${ean}/lock`,'POST', data);
  }

  // Unblock a card
  unblockCard (clientId, ean) {
    return this.createRequest(`/clients/${clientId}/cards/${ean}/lock`,'DELETE');
  }

  // Card info
  getCardInfo (clientId, ean) {
    return this.createRequest(`/clients/${clientId}/cards/${ean}`,'GET');
  }

  // Virtual card
  createVirtualCard (clientId) {
    const data = {client_id: clientId}
    return this.createRequest(`/clients/${clientId}/virtual-cards`,'POST', data);
  }

  // Activate card
  activateCard (clientId, ean) {
    return this.createRequest(`/clients/${clientId}/cards/${ean}/activate`,'POST');
  }

  // Activation status
  getActivationStatus (clientId, ean) {
    return this.createRequest(`/clients/${clientId}/cards/${ean}/activation`,'GET');
  }

  // Refill Card
  refillCard (clientId, ean) {
    return this.createRequest(`/clients/${clientId}/cards/${ean}/refill`,'POST');
  }

  // Withdraw money from card
  refillAccount (clientId, ean) {
    return this.createRequest(`/clients/${clientId}/cards/${ean}/withdrawal`,'POST');
  }

  // Send CVV
  getSecurityCode (clientId, ean) {
    return this.createRequest(`/clients/${clientId}/cards/${ean}/security-code`,'GET');
  }


  // Card2card Methods
  // Create payment link
  createPaymentLink (clientId) {
    return this.createRequest(`/clients/${clientId}/card2card`,'POST');
  }

  // Get payment link status
  getPaymentLinkStatus (clientId, paymentId) {
    return this.createRequest(`/clients/${clientId}/card2card/${paymentId}`,'GET');
  }


  // Card Delivery Methods
  // Create delivery
  createDelivery (clientId, data) {
    return this.createRequest(`/clients/${clientId}/card-deliveries`,'POST', data);
  }
  // Get delivery status
  getDeliveryStatus (clientId, deliveryId) {
    return this.createRequest(`/clients/${clientId}/card-deliveries/${deliveryId}`,'GET');
  }



  // Client Methods
  // Add client and start KYC
  // person = {client_id: 47, person: {...}}
  addClient (person) {
    return this.createRequest('/clients', 'POST', person);
  }

  // Get client's status
  getClientStatus (clientId) {
    return this.createRequest(`/clients/${clientId}`);
  }

  // Get client's cards
  getClientsCards (clientId) {
    return this.createRequest(`/clients/${clientId}/cards`);
  }

  // Event subscription methods
  // Subscribe to event
  subscribeToEvent(clientId, limit = 50, skip = 500, alpha = ''){
    const data = {client_id: clientId};
    const query = {limit: limit, skip: skip, alpha: alpha};
    return this.createRequest('/event-subscriptions', 'POST', data, query)
  }

  // Get subscriptions
  getSubscriptions(){
    return this.createRequest('/event-subscriptions');
  }

  // Delete subscriptions
  deleteSubscription(subscriptionId){
    return this.createRequest(`/event-subscriptions/${subscriptionId}`, 'DELETE');
  }

};
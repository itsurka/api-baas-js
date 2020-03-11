const axios = require('axios');
const sha256 = require('js-sha256').sha256;
const queryString = require('query-string');
const crypto = require('crypto');
const _ = require('lodash/core');


module.exports = class Client {

  /**
   * @param {string} partnerId
   * @param {string} token
   * @param {string} baseUrl
   */
  constructor(partnerId, token, baseUrl = null) {
    this.partnerId = partnerId;
    this.token = token;
    this.baseUrl = baseUrl ? baseUrl : `https://baas_test.talkbank.io/api/v1`;
    this.urlLocation = this.getLocation(this.baseUrl);

    this.config = {
      method: "",
      url: "",
      headers: {
        Authorization: "",
        date: "",
        host: this.urlLocation.host,
        'Content-Type': 'application/json'
      },
    };
  }

  // Create signature using HMAC.
  getSignature(config, query, url) {
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

  /**
   * Create axios request. Url = '', data = {}
   *
   * @param {string} url
   * @param {string} method
   * @param {object|null} data
   * @param {object|null} query
   * @param {object|null} options
   * @returns {Promise}
   */
  createRequest(url, method = 'GET', data = null, query = null, options = null) {
    const config = _.clone(this.config);

    if (options && options.rewriteUri) {
      config.url = `${this.urlLocation.protocol}//${this.urlLocation.host}${url}`;
    } else {
      config.url = `${this.baseUrl}${url}`;
    }

    query = queryString.stringify(query);
    if (query) {
      config.url = `${this.url}?${query}`;
    }

    const hasBody = data && Object.keys(data).length > 0 && (method === 'POST' || method === 'PUT');
    if (hasBody) {
      data = JSON.stringify(data);
      config.data = data;
    }

    config.method = method;
    config.headers.date = new Date().toUTCString();
    config.headers['tb-content-sha256'] = hasBody ? sha256(data) : sha256('');
    config.headers.Authorization = this.getSignature(config, query, url);

    return axios(config);
  }

  // Account Methods
  /**
   * Get account balance from bank
   *
   * GET /balance
   *
   * @returns {Promise}
   */
  accountBalance() {
    return this.createRequest('/balance', 'GET');
  }

  /**
   * @deprecated Synonym of the method accountBalance(), use this one instead
   * @returns {Promise}
   */
  getAccountBalance() {
    return this.accountBalance();
  }

  /**
   * Get account history
   *
   * GET /transactions
   *
   * @returns {Promise}
   */
  accountTransactions() {
    return this.createRequest('/transactions', 'GET');
  }

  /**
   * Transactions history from the bank account.
   *
   * @param {string|null} dateFrom
   * @param {string|null} dateTo
   * @param {string|null} bank
   * @param {string|null} limit
   * @param {string|null} page
   * @returns {Promise}
   */
  getAccountHistory(dateFrom = null, dateTo = null, bank = null, limit = null, page = null) {
    const query = {};
    if (bank) data.bank = bank;
    if (limit) data.limit = limit;
    if (page) data.page = page;
    if (dateFrom) data.dateFrom = dateFrom;
    if (dateTo) data.dateTo = dateTo;
    return this.createRequest('/transactions', 'GET', null, query);
  }

  /**
   * Get transactions for all partner's cards
   *
   * GET /cards-transactions
   *
   * @param {string} fromDate
   * @param {string} toDate
   * @param {int} page
   * @param {int} limit
   * @returns {Promise}
   */
  accountCardsTransactions(fromDate, toDate, page = 1, limit = 1000) {
    const query = this.filterData({
      fromDate: fromDate,
      toDate: toDate,
      page: page,
      limit: limit
    });

    return this.createRequest('/cards-transactions', 'GET', null, query);
  }

  /**
   * Get card history
   *
   * GET /clients/{client_id}/cards/{barcode}/transactions
   *
   * @param {string} clientId
   * @param {string} barcode
   * @param {string|null} dateFrom Datetime with timezone
   * @param {string|null} dateTo Datetime with timezone
   * @param {int|null} limit
   * @param {int|null} page
   * @returns {Promise}
   */
  cardTransactions(clientId, barcode, dateFrom = null, dateTo = null, limit = null, page = null) {
    const query = this.filterData({
      dateFrom: dateFrom,
      dateTo: dateTo,
      limit: limit,
      page: page,
    });
    return this.createRequest(`/clients/${clientId}/cards/${barcode}/transactions`, 'GET', null, query);
  }

  /**
   * @deprecated Synonym of the method cardTransactions(), use this one instead
   */
  getCardHistory(clientId, ean, dateFrom = null, dateTo = null, limit = null, page = null) {
    return this.cardTransactions(clientId, ean, dateFrom, dateTo, limit, page);
  }

  /**
   * Get client's cards
   *
   * GET /clients/{client_id}/cards
   *
   * @param {string} clientId
   * @returns {Promise}
   */
  cardList(clientId) {
    return this.createRequest(`/clients/${clientId}/cards`);
  }

  /**
   * @deprecated Synonym of the method cardList(), use this one instead
   */
  getClientsCards(clientId) {
    return this.cardList(clientId);
  }

  /**
   * Get card details
   *
   * GET /api/v1/clients/{client_id}/cards/{barcode}
   *
   * @param {string} clientId
   * @param {string} barcode
   * @return {Promise}
   */
  cardDetails(clientId, barcode) {
    return this.createRequest(`/clients/${clientId}/cards/${barcode}`);
  }

  /**
   * @deprecated Synonym of the method cardDetails(), use this one instead
   */
  getCardInfo(clientId, ean) {
    return this.cardDetails(clientId, ean);
  }

  /**
   * Get direct transaction's status, this is alias for `payment_status`
   *
   * GET /api/v1/clients/{client_id}/cards/{barcode}/{order_id}
   *
   * @param {string} clientId
   * @param {string} barcode
   * @param {string} orderId
   * @returns {Promise}
   */
  cardOrderStatus(clientId, barcode, orderId) {
    return this.createRequest(`/clients/${clientId}/cards/${barcode}/${orderId}`);
  }

  // Card Methods
  /**
   * Get card balance
   *
   * GET /clients/{client_id}/cards/{barcode}/balance
   *
   * @param clientId
   * @param barcode
   * @returns {Promise}
   */
  cardBalance(clientId, barcode) {
    return this.createRequest(`/clients/${clientId}/cards/${barcode}/balance`);
  }

  /**
   * @deprecated Synonym of the method cardBalance(), use this one instead
   */
  getCardBalance(clientId, ean) {
    return this.cardBalance(clientId, ean);
  }

  /**
   * Get card status
   *
   * GET /api/v1/clients/{client_id}/cards/{barcode}/lock
   *
   * @param clientId
   * @param barcode
   */
  cardLockStatus(clientId, barcode) {
    return this.createRequest(`/clients/${clientId}/cards/${barcode}/lock`);
  }

  /**
   * Block the card
   *
   * POST /api/v1/clients/{client_id}/cards/{barcode}/lock
   *
   * @param {string} clientId
   * @param {string} barcode
   * @param {string|null} reason
   */
  cardLock(clientId, barcode, reason = null) {
    const data = this.filterData({
      reason: reason
    });

    return this.createRequest(`/clients/${clientId}/cards/${barcode}/lock`, 'POST', data);
  }

  /**
   * @deprecated Synonym of the method cardLock(), use this one instead
   */
  blockCard(clientId, ean, reason = null) {
    return this.cardLock(clientId, ean, reason);
  }

  /**
   * Unblock the card
   *
   * DELETE /api/v1/clients/{client_id}/cards/{barcode}/lock
   *
   * @param {string} clientId
   * @param {string} barcode
   * @returns {Promise}
   */
  cardUnlock(clientId, barcode) {
    return this.createRequest(`/clients/${clientId}/cards/${barcode}/lock`, 'DELETE');
  }

  /**
   * @deprecated Synonym of the method cardUnlock(), use this one instead
   */
  unblockCard(clientId, ean) {
    return this.cardUnlock(clientId, ean);
  }

  /**
   * Create virtual card
   *
   * POST /clients/{client_id}/virtual-cards
   *
   * @param {string} clientId
   * @returns {Promise}
   */
  cardActivateVirtual(clientId) {
    return this.createRequest(`/clients/${clientId}/virtual-cards`, 'POST');
  }

  /**
   * @deprecated Synonym of the method cardActivateVirtual(), use this one instead
   */
  createVirtualCard(clientId) {
    return this.cardActivateVirtual(clientId);
  }

  /**
   * Activate card
   *
   * POST /api/v1/clients/{client_id}/cards/{barcode}/activate
   *
   * @param {string} clientId
   * @param {string} barcode
   * @returns {Promise}
   */
  cardActivate(clientId, barcode) {
    return this.createRequest(`/clients/${clientId}/cards/${barcode}/activate`, 'POST');
  }

  /**
   * @deprecated Synonym of the method cardActivate(), use this one instead
   */
  activateCard(clientId, ean) {
    return this.cardActivate(clientId, ean);
  }

  /**
   * Get card activation status
   *
   * GET /api/v1/clients/{client_id}/cards/{barcode}/activation
   *
   * @param {string} clientId
   * @param {string} barcode
   * @returns {Promise}
   */
  cardActivation(clientId, barcode) {
    return this.createRequest(`/clients/${clientId}/cards/${barcode}/activation`);
  }

  /**
   * @deprecated Synonym of the method cardActivation(), use this one instead
   */
  getActivationStatus(clientId, ean) {
    return this.cardActivation(clientId, ean);
  }

  /**
   * Sending a CVV on the client's phone
   *
   * GET /api/v1/clients/{client_id}/cards/{barcode}/security-code
   *
   * @param {string} clientId
   * @param {string} barcode
   * @return {Promise}
   */
  cardCvv(clientId, barcode) {
    return this.createRequest(`/clients/${clientId}/cards/${barcode}/security-code`);
  }

  /**
   * @deprecated Synonym of the method cardCvv(), use this one instead
   */
  getSecurityCode(clientId, ean) {
    return this.cardCvv(clientId, ean);
  }

  /**
   * Get cardholder data
   *
   * GET /api/v1/clients/{client_id}/cards/{barcode}/cardholder/data
   *
   * @param {string} clientId
   * @param {string} barcode
   * @returns {Promise}
   */
  cardCardholderData(clientId, barcode) {
    return this.createRequest(`/clients/${clientId}/cards/${barcode}/cardholder/data`);
  }

  /**
   * Get card limits
   *
   * GET /api/v1/clients/{client_id}/cards/{barcode}/limits
   *
   * @param {string} clientId
   * @param {string} barcode
   * @return {Promise}
   */
  cardLimits(clientId, barcode) {
    return this.createRequest(`/clients/${clientId}/cards/${barcode}/limits`);
  }

  /**
   * Refill card from account
   *
   * POST /api/v1/clients/{client_id}/cards/{barcode}/refill
   *
   * @param {string} clientId
   * @param {string} barcode
   * @param {float} amount
   * @param {string|null} orderId
   * @return {Promise}
   */
  cardRefill(clientId, barcode, amount, orderId = null) {
    const data = this.filterData({
      amount: amount,
      order_id: orderId,
    });

    return this.createRequest(`/clients/${clientId}/cards/${barcode}/refill`, 'POST', data);
  }

  /**
   * @deprecated Synonym of the method cardRefill(), use this one instead
   */
  refillCard(clientId, ean) {
    return this.cardRefill(clientId, ean);
  }

  /**
   * Withdraw money from the card
   *
   * POST /api/v1/clients/{client_id}/cards/{barcode}/withdrawal
   *
   * @param {string} clientId
   * @param {string} barcode
   * @param {float} amount
   * @param {string|null} orderId
   * @return {Promise}
   */
  cardWithdrawal(clientId, barcode, amount, orderId = null) {
    const data = this.filterData({
      amount: amount,
      order_id: orderId,
    });

    return this.createRequest(`/clients/${clientId}/cards/${barcode}/withdrawal`, 'POST', data);
  }

  /**
   * @deprecated Synonym of the method cardWithdrawal(), use this one instead
   */
  refillAccount(clientId, ean) {
    return this.cardWithdrawal(clientId, ean);
  }

  /**
   * Set PIN code for card (only for RFI now)
   *
   * POST /api/v1/clients/{client_id}/cards/{barcode}/set/pin
   *
   * @param {string} clientId
   * @param {string} barcode
   * @param {int} pinCode
   * @return {Promise}
   */
  setCardPin(clientId, barcode, pinCode) {
    const data = this.filterData({
      pin: pinCode,
    });

    return this.createRequest(`/clients/${clientId}/cards/${barcode}/set/pin`, 'POST', data);
  }

  /**
   * Get identification pdf for Client/Card (a few banks only)
   *
   * GET /api/v1/clients/{client_id}/cards/{barcode}/pdf
   *
   * @param {string} clientId
   * @param {string} barcode
   * @return {Promise}
   */
  cardPdf(clientId, barcode) {
    return this.createRequest(`/clients/${clientId}/cards/${barcode}/pdf`);
  }

  // Card2card Methods
  // Create payment link
  createPaymentLink(clientId) {
    return this.createRequest(`/clients/${clientId}/card2card`, 'POST');
  }

  // Get payment link status
  getPaymentLinkStatus(clientId, paymentId) {
    return this.createRequest(`/clients/${clientId}/card2card/${paymentId}`, 'GET');
  }

  // Event subscription methods
  /**
   * Get callbacks
   *
   * GET /api/v1/event-subscriptions
   *
   * @return {Promise}
   */
  eventSubscriptionList() {
    return this.createRequest('/event-subscriptions');
  }

  /**
   * @deprecated Synonym of the method eventSubscriptionList(), use this one instead
   */
  getSubscriptions() {
    return this.eventSubscriptionList();
  }

  /**
   * Add event subscription
   *
   * POST /api/v1/event-subscriptions
   *
   * @param {string} url
   * @param {array|null} events
   * @return {Promise}
   */
  eventSubscriptionStore(url, events = null) {
    const data = this.filterData({
      url: url,
      events: events
    });

    return this.createRequest('/event-subscriptions', 'POST', data);
  }

  /**
   * Subscribe to event
   *
   * @param clientId
   * @param limit
   * @param skip
   * @param alpha
   * @return {Promise}
   *
   * @deprecated Use eventSubscriptionStore() instead!
   */
  subscribeToEvent(clientId, limit = 50, skip = 500, alpha = '') {
    const data = {client_id: clientId};
    const query = {limit: limit, skip: skip, alpha: alpha};
    return this.createRequest('/event-subscriptions', 'POST', data, query)
  }

  /**
   * Delete subscription
   *
   * DELETE /api/v1/event-subscriptions/{subscription_id}
   *
   * @param {string} subscriptionId
   * @return {Promise}
   */
  eventSubscriptionRemove(subscriptionId) {
    return this.createRequest(`/event-subscriptions/${subscriptionId}`, 'DELETE');
  }

  /**
   * @deprecated Synonym of the method eventSubscriptionRemove(), use this one instead
   */
  deleteSubscription(subscriptionId) {
    return this.eventSubscriptionRemove(subscriptionId);
  }

  // Card Delivery Methods

  /**
   * Add new delivery
   *
   * POST /api/v1/clients/{client_id}/card-deliveries
   *
   * @param {string} clientId
   * @param {object} data
   * @return {Promise}
   */
  cardDeliveryStore(clientId, data) {
    return this.createRequest(`/clients/${clientId}/card-deliveries`, 'POST', data);
  }

  /**
   * @deprecated Synonym of the method cardDeliveryStore(), use this one instead
   */
  createDelivery(clientId, data) {
    return this.cardDeliveryStore(clientId, data);
  }

  /**
   * Get info about delivery
   *
   * GET ​/api​/v1​/clients​/{client_id}​/card-deliveries​/{delivery_id}
   *
   * @param {string} clientId
   * @param {string} deliveryId
   * @return {Promise}
   */
  cardDeliveryShow(clientId, deliveryId) {
    return this.createRequest(`/clients/${clientId}/card-deliveries/${deliveryId}`);
  }

  /**
   * @deprecated Synonym of the method cardDeliveryShow(), use this one instead
   */
  getDeliveryStatus(clientId, deliveryId) {
    return this.cardDeliveryShow(clientId, deliveryId);
  }

  // Client Methods
  /**
   * Create the client
   *
   * POST /api/v1/clients
   *
   * @param {string} clientId
   * @param {object} person
   * @return {Promise}
   */
  clientStore(clientId, person) {
    return this.createRequest('/clients', 'POST', {
      client_id: clientId,
      person: person
    });
  }

  /**
   * @deprecated Synonym of the method clientStore(), use this one instead
   *
   * @param {object} person {client_id: 47, person: {...}}
   */
  addClient(person) {
    return this.clientStore(person.client_id, person.person);
  }

  /**
   * Update the client
   *
   * PUT /api/v1/clients/{client_id}
   *
   * @param clientId
   * @param person
   * @return {Promise}
   */
  clientEdit(clientId, person) {
    return this.createRequest('/clients', 'PUT', {
      client_id: clientId,
      person: person
    });
  }

  /**
   * Get client's status
   *
   * GET /api/v1/clients/{client_id}
   *
   * @param {string} clientId
   * @return {Promise}
   */
  clientShow(clientId) {
    return this.createRequest(`/clients/${clientId}`);
  }

  /**
   * @deprecated Synonym of the method clientShow(), use this one instead
   */
  getClientStatus(clientId) {
    return this.clientShow(clientId);
  }

  /**
   * Hold money from registered or unregistered card
   *
   * POST /api/v1/hold
   *
   * @param {int|null} amount
   * @param {string|null} orderSlug
   * @param {object|null} cardInfo
   * @param {string|null} cardRefId
   * @param {string|null} redirectUrl
   * @return {Promise}
   */
  hold(amount = null, orderSlug = null, cardInfo = null, cardRefId = null, redirectUrl = null) {
    const data = this.filterData({
      amount: amount,
      order_slug: orderSlug,
      card_info: cardInfo,
      card_ref_id: cardRefId,
      redirect_url: redirectUrl
    });

    return this.createRequest(`/hold`, 'POST', data);
  }

  /**
   * Hold money from registered or unregistered card with payment form
   *
   * POST /api/v1/hold/{client_id}/with/form
   *
   * @param {string} clientId
   * @param {string} redirectUrl
   * @param {int} amount
   * @param {string|null} orderSlug
   * @param {string|null} cardToken
   * @return {Promise}
   */
  holdWithForm(clientId, redirectUrl, amount, orderSlug = null, cardToken = null) {
    const data = this.filterData({
      redirect_url: redirectUrl,
      amount: amount,
      order_slug: orderSlug,
      card_token: cardToken
    });

    return this.createRequest(`/hold/${clientId}/with/form`, 'POST', data);
  }

  /**
   * Confirm full or partial hold
   *
   * POST /api/v1/hold/confirm/{order_slug}
   *
   * @param {string} orderSlug
   * @param {int|null} amount
   * @return {Promise}
   */
  holdConfirm(orderSlug, amount = null) {
    const data = this.filterData({
      amount: amount
    });

    return this.createRequest(`/hold/confirm/${orderSlug}`, 'POST', data);
  }

  /**
   * Reverse hold
   *
   * POST /api/v1/hold/reverse/{order_slug}
   *
   * @param {string} orderSlug
   * @param {int|null} amount
   * @return {Promise}
   */
  holdReverse(orderSlug, amount = null) {
    const data = this.filterData({
      amount: amount
    });

    return this.createRequest(`/hold/reverse/${orderSlug}`, 'POST', data);
  }

  /**
   * Charge/withdraw money from card to account
   *
   * POST /api/v1/charge/{client_id}/unregistered/card
   *
   * @param {string} clientId
   * @param {int} amount
   * @param {object} cardInfo
   * @param {string|null} redirectUrl
   * @param {string|null} orderSlug
   * @return {Promise}
   */
  paymentFromUnregisteredCard(clientId, amount, cardInfo, redirectUrl = null, orderSlug = null) {
    const data = this.filterData({
      amount: amount,
      card_info: cardInfo,
      redirect_url: redirectUrl,
      order_slug: orderSlug
    });

    return this.createRequest(`/charge/${clientId}/unregistered/card`, 'POST', data);
  }

  /**
   * Create token for clientCharge
   *
   * POST /api/v1/charge/{client_id}/token
   *
   * @param {string} clientId
   * @param {string} redirectUrl
   * @param {int} amount
   * @return {Promise}
   */
  paymentFromUnregisteredCardToken(clientId, redirectUrl, amount) {
    const data = this.filterData({
      redirect_url: redirectUrl,
      amount: amount
    });

    return this.createRequest(`/charge/${clientId}/token`, 'POST', data);
  }

  /**
   * POST /api/v1/refill/{client_id}/token
   *
   * @param {string} clientId
   * @param {int} amount
   * @param {string|null} orderSlug
   * @return {Promise}
   */
  paymentToUnregisteredCardToken(clientId, amount, orderSlug = null) {
    const data = this.filterData({
      amount: amount,
      order_slug: orderSlug
    });

    return this.createRequest(`/refill/${clientId}/token`, 'POST', data);
  }

  /**
   * POST /api/v1/charge/{client_id}/unregistered/card/with/form
   *
   * @param {string} clientId
   * @param {int} amount
   * @param {string|null} orderSlug
   * @param {string|null} redirectUrl
   * @return {Promise}
   */
  paymentFromUnregisteredCardWithForm(clientId, amount, orderSlug = null, redirectUrl = null) {
    const data = this.filterData({
      amount: amount,
      order_slug: orderSlug,
      redirect_url: redirectUrl
    });

    return this.createRequest(`/charge/${clientId}/unregistered/card/with/form`, 'POST', data);
  }

  /**
   * Charge card without 3ds
   *
   * POST /api/v1/payment/from/{client_id}/registered/card
   *
   * @param {string} clientId
   * @param {int} amount
   * @param {string} cardToken
   * @param {string|null} orderSlug
   * @return {Promise}
   */
  paymentFromRegisteredCard(clientId, amount, cardToken, orderSlug = null) {
    const data = this.filterData({
      amount: amount,
      card_token: cardToken,
      order_slug: orderSlug
    });

    return this.createRequest(`/payment/from/${clientId}/registered/card`, 'POST', data);
  }

  /**
   * Refill card from account
   *
   * POST /api/v1/authorize/card/{client_id}
   *
   * @param {string} clientId
   * @param {object} cardInfo
   * @param {string|null} redirectUrl
   * @return {Promise}
   */
  paymentAuthorization(clientId, cardInfo, redirectUrl = null) {
    const data = this.filterData({
      card_info: cardInfo,
      redirect_url: redirectUrl
    });

    return this.createRequest(`/authorize/card/${clientId}`, 'POST', data);
  }

  /**
   * Get tokens for authorization on a client side
   *
   * POST /api/v1/authorize/card/{client_id}/token
   *
   * @param {string} clientId
   * @param {string|null} redirectUrl
   * @return {Promise}
   */
  paymentAuthorizationToken(clientId, redirectUrl = null) {
    const data = this.filterData({
      redirect_url: redirectUrl
    });

    return this.createRequest(`/authorize/card/${clientId}/token`, 'POST', data);
  }

  /**
   * POST /api/v1/authorize/card/{client_id}/with/form
   *
   * @param {string} clientId
   * @param {string|null} redirectUrl
   * @param {string|null} orderSlug
   * @return {Promise}
   */
  paymentAuthorizationWithForm(clientId, redirectUrl = null, orderSlug = null) {
    const data = this.filterData({
      redirect_url: redirectUrl,
      order_slug: orderSlug
    });

    return this.createRequest(`/authorize/card/${clientId}/with/form`, 'POST', data);
  }

  /**
   * POST /api/v1/payment/to/{client_id}/registered/card
   *
   * @param {string} clientId
   * @param {string} cardToken
   * @param {int} amount
   * @param {string|null} orderSlug
   * @return {Promise}
   */
  paymentToRegisteredCard(clientId, cardToken, amount, orderSlug = null) {
    const data = this.filterData({
      card_token: cardToken,
      amount: amount,
      order_slug: orderSlug
    });

    return this.createRequest(`/payment/to/${clientId}/registered/card`, 'POST', data);
  }

  /**
   * POST /api/v1/account/transfer
   *
   * @param {int} amount
   * @param {string} account
   * @param {string} bik
   * @param {string} name
   * @param {string|null} inn
   * @param {string|null} description
   * @param {string|null} orderSlug
   * @return {Promise}
   */
  paymentToAccount(amount, account, bik, name, inn = null, description = null, orderSlug = null) {
    const data = this.filterData({
      amount: amount,
      account: account,
      bik: bik,
      name: name,
      inn: inn,
      description: description,
      order_slug: orderSlug
    });

    return this.createRequest(`/account/transfer`, 'POST', data);
  }

  /**
   * Refill card by cardNumber
   *
   * POST /api/v1/refill/unregistered/card
   *
   * @param {string} cardNumber
   * @param {int|null} amount
   * @param {string|null} orderSlug
   * @return {Promise}
   */
  paymentToUnregisteredCard(cardNumber, amount = null, orderSlug = null) {
    const data = this.filterData({
      card_number: cardNumber,
      amount: amount,
      order_slug: orderSlug
    });

    return this.createRequest(`/refill/unregistered/card`, 'POST', data);
  }

  /**
   * POST /api/v1/refill/{client_id}/unregistered/card/with/form
   *
   * @param {string} clientId
   * @param {int} amount
   * @param {string|null} orderSlug
   * @param {string|null} redirectUrl
   * @return {Promise}
   */
  paymentToUnregisteredCardWithForm(clientId, amount, orderSlug = null, redirectUrl = null) {
    const data = this.filterData({
      amount: amount,
      order_slug: orderSlug,
      redirect_url: redirectUrl
    });

    return this.createRequest(`/refill/${clientId}/unregistered/card/with/form`, 'POST', data);
  }

  /**
   * Get direct payment status
   *
   * GET /api/v1/payment/{order_slug}
   *
   * @param {string} orderSlug
   * @return {Promise}
   */
  paymentStatus(orderSlug) {
    return this.createRequest(`/payment/${orderSlug}`);
  }

  /**
   * GET /api/v1/selfemployments/{client_id}
   *
   * @param {string} clientId
   * @return {Promise}
   */
  selfemploymentsRegistrationStatus(clientId) {
    return this.createRequest(`/selfemployments/${clientId}`);
  }

  /**
   * Charge method for Client (w/o signature!)
   *
   * POST /client/v1/charge
   *
   * @param {string} token
   * @param {int} amount
   * @param {object} cardInfo
   * @return {Promise}
   */
  unsignedPaymentFromUnregisteredCard(token, amount, cardInfo) {
    const data = this.filterData({
      token: token,
      amount: amount,
      card_info: cardInfo
    });

    return this.createRequest(`/client/v1/charge`, 'POST', data, null, {rewriteUri: true});
  }

  /**
   * Refill a card on the client-side using a temp token,
   * see payment_to_unregistered_card_token & payment_to_unregistered_card_with_form
   *
   * POST /client/v1/refill
   *
   * @param {string} token
   * @param {string} cardNumber
   * @return {Promise}
   */
  unsignedPaymentToUnregisteredCard(token, cardNumber) {
    const data = this.filterData({
      token: token,
      card_number: cardNumber
    });

    return this.createRequest(`/client/v1/refill`, 'POST', data, null, {rewriteUri: true});
  }

  /**
   * POST /client/v1/authorize
   *
   * @param {string} token
   * @param {object} cardInfo
   * @return {Promise}
   */
  unsignedPaymentAuthorization(token, cardInfo) {
    const data = this.filterData({
      token: token,
      card_info: cardInfo
    });

    return this.createRequest(`/client/v1/authorize`, 'POST', data, null, {rewriteUri: true});
  }

  /**
   * Hold card on the client-side
   *
   * POST /client/v1/hold
   *
   * @param {string} token
   * @param {object} cardInfo
   * @return {Promise}
   */
  unsignedHold(token, cardInfo) {
    const data = this.filterData({
      token: token,
      card_info: cardInfo
    });

    return this.createRequest(`/client/v1/hold`, 'POST', data, null, {rewriteUri: true});
  }

  /**
   * Get status by token
   *
   * GET /client/v1/status/{hash}
   *
   * @param {string} hash
   * @return {Promise}
   */
  unsignedPaymentStatusByHash(hash) {
    return this.createRequest(`/client/v1/status/${hash}`, 'GET', null, null, {rewriteUri: true});
  }

  /**
   * @param {object} data
   * @returns {Promise}
   */
  filterData(data) {
    for (var propName in data) {
      if (data[propName] === null || data[propName] === undefined) {
        delete data[propName];
      }
    }

    return data;
  }

  getLocation(href) {
    var match = href.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);
    return match && {
      href: href,
      protocol: match[1],
      host: match[2],
      hostname: match[3],
      port: match[4],
      pathname: match[5],
      search: match[6],
      hash: match[7]
    }
  }
};
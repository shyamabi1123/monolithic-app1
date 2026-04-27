const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const logger = require('../config/logger');

async function createPaymentIntent(amountInCents, currency = 'usd', metadata = {}) {
  try {
    const intent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      metadata,
      automatic_payment_methods: { enabled: true }
    });
    return intent;
  } catch (err) {
    logger.error('Stripe createPaymentIntent error:', err);
    throw err;
  }
}

async function confirmPayment(paymentIntentId) {
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    logger.error('Stripe confirmPayment error:', err);
    throw err;
  }
}

function constructWebhookEvent(rawBody, sig) {
  return stripe.webhooks.constructEvent(
    rawBody,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

module.exports = { createPaymentIntent, confirmPayment, constructWebhookEvent };

const express = require('express');
const cors = require('cors');
require('dotenv').config();

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("CRITICAL ERROR: STRIPE_SECRET_KEY is not set inside Render environment variables!");
}
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// Dynamic Price Calculation with Shipping
function calculateOrderAmount(items) {
  let itemsTotalInCents = 0;
  
  items.forEach(item => {
    const basePrice = 35.00; 
    const quantity = item.qty || 1;
    itemsTotalInCents += (basePrice * 100) * quantity;
  });

  // Add flat shipping fee of $7.50 (750 cents)
  const shippingInCents = 750; 
  
  return itemsTotalInCents + shippingInCents;
}

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { items, email, name } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).send({ error: "Your cart appears to be empty." });
    }

    const amountInCents = calculateOrderAmount(items);

    const itemDescriptions = items.map(item => {
      return `${item.qty}x ${item.bike} (${item.color})`;
    }).join(', ');

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      description: `VoltMoto Order: ${itemDescriptions} (+ $7.50 Shipping)`,
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: email,
      metadata: {
        customer_name: name,
        customer_email: email,
        items_ordered: itemDescriptions,
        shipping_fee: "$7.50"
      }
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });

  } catch (error) {
    console.error("Stripe Error Details:", error.message);
    res.status(500).send({ error: error.message });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`VoltMoto server initializing smoothly on port ${PORT}`));

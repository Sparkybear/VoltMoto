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

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { items, email, name, discountPercent, isFreeShipping } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).send({ error: "Your cart appears to be empty." });
    }

    // 1. Secure calculation using a standard loop
    let baseTotal = 0;
    for (const item of items) {
      baseTotal += 35.00 * item.qty;
    }

    // 2. Apply percentage discount (like 0.10 for 10% off)
    const activeDiscount = discountPercent || 0;
    const discountAmount = baseTotal * activeDiscount;
    const discountedSubtotal = baseTotal - discountAmount;

    // 3. Determine shipping cost
    const shippingCost = isFreeShipping ? 0 : 7.50;
    const finalTotalCents = Math.round((discountedSubtotal + shippingCost) * 100);

    // 4. Generate dynamic item description strings for Stripe receipts
    const itemDescriptions = items.map(item => {
      return `${item.qty}x ${item.bike} (${item.color})`;
    }).join(', ');

    const shippingDisplay = isFreeShipping ? "FREE Shipping" : "$7.50 Shipping";

    // 5. Create a single, clean Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalTotalCents,
      currency: 'usd',
      description: `VoltMoto Order: ${itemDescriptions} (+ ${shippingDisplay})`,
      receipt_email: email || undefined,
      metadata: {
        customer_name: name || 'Customer',
        customer_email: email || 'N/A',
        items_ordered: itemDescriptions,
        shipping_fee: isFreeShipping ? "FREE" : "$7.50",
        discount_percentage: `${activeDiscount * 100}%`
      },
      automatic_payment_methods: { enabled: true },
    });

    // 6. Send client secret back to the frontend
    res.send({ clientSecret: paymentIntent.client_secret });

  } catch (error) {
    console.error("Stripe Error Details:", error.message);
    res.status(500).send({ error: error.message });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`VoltMoto server initializing smoothly on port ${PORT}`));

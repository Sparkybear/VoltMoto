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

// Dynamic Price Calculation
function calculateOrderAmount(items) {
  let totalInCents = 0;
  
  items.forEach(item => {
    // Both Yellow and White options now retain the updated base price of $35.00
    const basePrice = 35.00; 
    
    const quantity = item.qty || 1;
    totalInCents += (basePrice * 100) * quantity; // Convert to Stripe cents ($35.00 -> 3500 cents)
  });

  return totalInCents;
}

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { items, email, name } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).send({ error: "Your cart appears to be empty." });
    }

    const amountInCents = calculateOrderAmount(items);

    // Build a clean, readable breakdown of items (e.g., "1x Surron Light Bee X (Yellow)")
    const itemDescriptions = items.map(item => {
      return `${item.qty}x ${item.bike} (${item.color})`;
    }).join(', ');

    // Create the payment intent with explicit descriptions and metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      description: `VoltMoto Order: ${itemDescriptions}`, // Shows at the very top of your payment window
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: email,
      metadata: {
        customer_name: name,
        customer_email: email,
        items_ordered: itemDescriptions // Populates the metadata sidebar in the Stripe dashboard
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

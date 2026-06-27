const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Ensure your Stripe Secret Key is loaded securely from environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("CRITICAL ERROR: STRIPE_SECRET_KEY is not set inside Render environment variables!");
}
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// 1. Enable CORS so your GitHub Pages frontend domain can securely communicate with Render
app.use(cors());

// 2. Enable JSON parsing to read the cart body sent by your frontend
app.use(express.json());

// Helper function to safely calculate order totals on the server.
// Stripe calculates transactions in the lowest currency unit (cents).
function calculateOrderAmount(items) {
  let totalInCents = 0;
  
  items.forEach(item => {
    // Default VoltMoto plug-and-play headlight base price: $150.00 -> 15000 cents
    const basePriceInCents = 15000; 
    const quantity = item.qty || 1;
    totalInCents += basePriceInCents * quantity;
  });

  return totalInCents;
}

// 3. Main Route: Receives cart items from frontend and requests a clientSecret from Stripe
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { items, email, name } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).send({ error: "Your cart appears to be empty." });
    }

    const amountInCents = calculateOrderAmount(items);

    // Create the payment intent via Stripe API
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: email,
      metadata: {
        customer_name: name
      }
    });

    // Send back the initialization key that Stripe Elements requires to display fields
    res.send({
      clientSecret: paymentIntent.client_secret,
    });

  } catch (error) {
    console.error("Stripe Error Details:", error.message);
    res.status(500).send({ error: error.message });
  }
});

// Start listening on Render's assigned dynamic port, defaulting to 4242 locally
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`VoltMoto server initializing smoothly on port ${PORT}`));

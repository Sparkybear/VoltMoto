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
    // 1. Pull the items, discount, and shipping details sent from the frontend
    const { items, email, name, discountPercent, isFreeShipping } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).send({ error: "Your cart appears to be empty." });
    }

    // 2. Calculate your secure base items subtotal
    // (We hardcode the $35.00 base headlight price here for security)
    let baseTotal = 0;
    items.forEach(item => {
      baseTotal += 35.00 * item.qty;
    });

    // 3. Securely apply the percentage discount (like 0.10 for 10% off)
    const activeDiscount = discountPercent || 0;
    const discountAmount = baseTotal * activeDiscount;
    const discountedSubtotal = baseTotal - discountAmount;

    // 4. Calculate the shipping cost ($0 if free shipping is active, otherwise $7.50)
    const shippingCost = isFreeShipping ? 0 : 7.50;

    // 5. Stripe calculates in CENTS (e.g. $35.00 is 3500 cents)
    const finalTotalCents = Math.round((discountedSubtotal + shippingCost) * 100);

    // 6. Create the Stripe Payment Intent with the discounted total
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalTotalCents,
      currency: 'usd',
      receipt_email: email, // Optional: attaches the user's email for Stripe receipts
      metadata: { name: name }, // Optional: attaches customer name to the transaction
      automatic_payment_methods: { enabled: true },
    });

    // 7. Send the secure client secret back to the browser
    res.send({ clientSecret: paymentIntent.client_secret });

  } catch (e) {
    console.error("Stripe Error:", e.message);
    res.status(400).send({ error: e.message });
  }
});

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

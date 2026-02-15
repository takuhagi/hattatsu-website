const Stripe = require('stripe');

const PLANS = {
    light: {
        name: '特性クイック診断',
        description: 'オンライン30分・診断レポート付き',
        price: 5000,
        mode: 'payment',
    },
    standard: {
        name: '特性把握セッション',
        description: 'オンライン90分・調整プラン付き',
        price: 15000,
        mode: 'payment',
    },
    premium: {
        name: '継続調整プログラム',
        description: '月2回セッション+LINE相談（月額）',
        price: 39800,
        mode: 'subscription',
    },
};

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: 'Stripe secret key is not configured' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    try {
        const { planId, customerName, customerEmail, concern } = req.body;

        const plan = PLANS[planId];
        if (!plan) {
            return res.status(400).json({ error: 'Invalid plan selected' });
        }

        const origin = req.headers.origin || req.headers.referer?.replace(/\/[^/]*$/, '') || 'https://hattatsu-website.vercel.app';

        const sessionParams = {
            payment_method_types: ['card'],
            customer_email: customerEmail || undefined,
            metadata: {
                plan_id: planId,
                customer_name: customerName || '',
                concern: concern || '',
            },
            success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/payment.html?plan=${planId}&canceled=true`,
        };

        if (plan.mode === 'subscription') {
            sessionParams.mode = 'subscription';
            sessionParams.line_items = [{
                price_data: {
                    currency: 'jpy',
                    product_data: {
                        name: plan.name,
                        description: plan.description,
                    },
                    unit_amount: plan.price,
                    recurring: {
                        interval: 'month',
                    },
                },
                quantity: 1,
            }];
        } else {
            sessionParams.mode = 'payment';
            sessionParams.line_items = [{
                price_data: {
                    currency: 'jpy',
                    product_data: {
                        name: plan.name,
                        description: plan.description,
                    },
                    unit_amount: plan.price,
                },
                quantity: 1,
            }];
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        return res.status(200).json({ url: session.url });
    } catch (err) {
        console.error('Stripe error:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

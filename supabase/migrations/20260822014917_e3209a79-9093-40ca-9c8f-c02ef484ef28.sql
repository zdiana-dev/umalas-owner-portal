UPDATE public.units
SET purchase_price = 2660000000,
    purchase_currency = 'IDR',
    is_investment_contract = true
WHERE code = 'C102';

SELECT id, code, purchase_price, purchase_currency, is_investment_contract
FROM public.units
WHERE code = 'C102';
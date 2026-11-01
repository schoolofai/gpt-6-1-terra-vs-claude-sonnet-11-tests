WITH item_totals AS (
    SELECT order_id, SUM(qty * unit_price_pence) AS gross_pence
    FROM order_items
    GROUP BY order_id
), refund_totals AS (
    SELECT order_id, SUM(amount_pence) AS refund_pence
    FROM refunds
    GROUP BY order_id
), country_totals AS (
    SELECT COALESCE(c.country, 'Unknown') AS country,
           SUM(COALESCE(i.gross_pence, 0) - COALESCE(r.refund_pence, 0)) AS net_pence
    FROM orders AS o
    JOIN customers AS c ON c.id = o.customer_id
    LEFT JOIN item_totals AS i ON i.order_id = o.id
    LEFT JOIN refund_totals AS r ON r.order_id = o.id
    WHERE o.status = 'paid'
    GROUP BY COALESCE(c.country, 'Unknown')
)
SELECT country, printf('%.2f', net_pence / 100.0) AS net_pounds
FROM country_totals
ORDER BY net_pence DESC, country;

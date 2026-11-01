WITH customer_totals AS (
    SELECT c.id, c.name, COALESCE(SUM(i.qty * i.unit_price_pence), 0) AS gross_pence
    FROM customers AS c
    JOIN orders AS o ON o.customer_id = c.id AND o.status = 'paid'
    LEFT JOIN order_items AS i ON i.order_id = o.id
    GROUP BY c.id, c.name
)
SELECT name, printf('%.2f', gross_pence / 100.0) AS gross_pounds
FROM customer_totals
ORDER BY gross_pence DESC, name ASC, id ASC
LIMIT 3;

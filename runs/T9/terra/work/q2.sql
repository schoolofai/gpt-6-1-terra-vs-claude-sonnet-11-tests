WITH paid_months AS (
    SELECT DISTINCT substr(order_date, 1, 7) AS month
    FROM orders
    WHERE status = 'paid'
      AND order_date >= '2026-01-01' AND order_date < '2027-01-01'
), first_paid AS (
    SELECT customer_id, MIN(order_date) AS first_date
    FROM orders
    WHERE status = 'paid'
    GROUP BY customer_id
)
SELECT m.month, COUNT(f.customer_id) AS new_customers
FROM paid_months AS m
LEFT JOIN first_paid AS f ON substr(f.first_date, 1, 7) = m.month
GROUP BY m.month
ORDER BY m.month;

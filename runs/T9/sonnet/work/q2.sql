SELECT month, COUNT(*) AS new_customers FROM (
 SELECT customer_id, substr(MIN(order_date),1,7) AS month FROM orders WHERE status='paid' GROUP BY customer_id)
WHERE month LIKE '2026-%' GROUP BY month ORDER BY month;

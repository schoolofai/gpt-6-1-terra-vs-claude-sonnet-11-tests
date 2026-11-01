SELECT country, printf('%.2f', SUM(net)/100.0) AS net_pounds FROM (
 SELECT COALESCE(NULLIF(TRIM(c.country),''),'Unknown') AS country,
  COALESCE((SELECT SUM(qty*unit_price_pence) FROM order_items i WHERE i.order_id=o.id),0)
  - COALESCE((SELECT SUM(amount_pence) FROM refunds r WHERE r.order_id=o.id),0) AS net
 FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.status='paid')
GROUP BY country ORDER BY SUM(net) DESC, country;

SELECT c.name, printf('%.2f', SUM(i.qty*i.unit_price_pence)/100.0) AS gross_pounds
FROM orders o JOIN customers c ON c.id=o.customer_id JOIN order_items i ON i.order_id=o.id
WHERE o.status='paid' GROUP BY c.id ORDER BY SUM(i.qty*i.unit_price_pence) DESC, c.name ASC LIMIT 3;

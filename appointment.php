<?php
header("Content-Type: application/json");
$conn = new mysqli("localhost","root","","appointments");
if ($conn->connect_error) { die(json_encode(["error"=>"DB failed"])); }

$name = $_POST["name"] ?? "";
$phone = $_POST["phone"] ?? "";
$slot = $_POST["slot"] ?? "";

$conn->query("INSERT INTO bookings (name, phone, slot) VALUES ('$name','$phone','$slot')");
echo json_encode(["status"=>"booked"]);
?>

<?php
header("Content-Type: application/json");
$conn = new mysqli("localhost","u644637155_appointments","u644637155_appointments","e^NUf?&9&wK5");
if ($conn->connect_error) { die(json_encode(["error"=>"DB failed"])); }

$name = $_POST["name"] ?? "";
$age = $_POST["age"] ?? "";
$problem = $_POST["problem"] ?? "";
$date = $_POST["date"] ?? "";
$time = $_POST["time"] ?? "";

$conn->query("INSERT INTO bookings (name, age, problem, date, time) VALUES ('$name','$age','$problem', '$date', '$time')");
echo json_encode(["status"=>"booked"]);
?>

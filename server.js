/* =============================
   STEP 5 — TIME SLOT + SAVE
============================= */

app.post("/get-time", (req, res) => {

  const twiml = new VoiceResponse();

  const speech =
    (req.body.SpeechResult || "")
      .toLowerCase()
      .trim();

  console.log("Time speech:", speech);

  /* AVAILABLE TIME SLOTS */

  const timeSlots = [
    "10:00 am",
    "11:30 am",
    "2:00 pm",
    "4:30 pm"
  ];

  let selectedTime = null;

  for (let slot of timeSlots) {

    if (
      speech.includes(slot) ||
      speech.includes(
        slot.replace(":", "")
      ) ||
      speech.includes(
        slot.replace(":00", "")
      )
    ) {
      selectedTime = slot;
      break;
    }

  }

  /* IF VALID SLOT */

  if (selectedTime) {

    bookingData.time =
      selectedTime;

    console.log(
      "Final booking:",
      bookingData
    );

    saveAppointmentAsync(
      bookingData
    );

    twiml.say(
      {
        voice: "Polly.Joanna"
      },
      `Your appointment has been booked for ${selectedTime}. Thank you.`
    );

    twiml.hangup();

  }

  /* IF INVALID SLOT */

  else {

    const gather =
      twiml.gather({

        input: "speech",

        language: "en-US",

        action:
          `${process.env.PUBLIC_URL}/get-time`,

        method: "POST",

        timeout: 3,

        speechTimeout: "auto",

        actionOnEmptyResult: true
      });

    gather.say(
      {
        voice: "Polly.Joanna"
      },
      "Please choose a valid time slot. Available times are 10 AM, 11:30 AM, 2 PM, or 4:30 PM."
    );

  }

  res.type("text/xml");
  res.send(
    twiml.toString()
  );

});

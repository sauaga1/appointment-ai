app.post("/menu", (req, res) => {

  const twiml =
    new VoiceResponse();

  const digit =
    req.body.Digits;

  if (digit === "1") {

    let message =
      "कृपया तारीख चुनें। ";

    for (
      let i = 0;
      i < 7;
      i++
    ) {

      const d =
        new Date();

      d.setDate(
        d.getDate() + i
      );

      const text =
        d.toLocaleDateString(
          "hi-IN",
          {
            day: "numeric",
            month: "long"
          }
        );

      message +=
        `${text} के लिए ${
          i + 1
        } दबाएं। `;

    }

    const gather =
      twiml.gather({

        input: "dtmf",

        numDigits: 1,

        timeout: 7,

        action:
          `${process.env.PUBLIC_URL}/get-date`

      });

    gather.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      message
    );

  }

  else {

    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "धन्यवाद।"
    );

    twiml.hangup();

  }

  res.type("text/xml");
  res.send(
    twiml.toString()
  );

});

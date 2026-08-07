export async function generateDefaultThumbnail(title = "") {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");

    canvas.width = 1280;
    canvas.height = 720;

    const ctx = canvas.getContext("2d");

    // ==========================
    // GREEN GRADIENT BACKGROUND
    // ==========================
    const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
    gradient.addColorStop(0, "#065F46");
    gradient.addColorStop(0.5, "#059669");
    gradient.addColorStop(1, "#6EE7B7");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ==========================
    // TOP RIGHT BIG CIRCLE
    // ==========================
    ctx.beginPath();
    ctx.arc(1220, -40, 230, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fill();

    // Rings
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 3;

    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(1220, -40, 170 + i * 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ==========================
    // BOTTOM LEFT CIRCLE
    // ==========================
    ctx.beginPath();
    ctx.arc(-60, 760, 180, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();

    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-60, 760, 150 + i * 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ==========================
    // Decorative Dots (Top Left)
    // ==========================
    drawDots(ctx, 60, 55);

    // Decorative Dots (Bottom Right)
    drawDots(ctx, 1120, 560);

    // ==========================
    // TITLE
    // ==========================
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 72px Arial";

    const lines = wrapText(ctx, title.toUpperCase(), 820);

    let y = 330 - ((lines.length - 1) * 45);

    lines.forEach((line) => {
      ctx.fillText(line, 640, y);
      y += 82;
    });

    // ==========================
    // Divider
    // ==========================
    ctx.beginPath();
    ctx.moveTo(420, y + 15);
    ctx.lineTo(860, y + 15);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // ==========================
    // Bottom Text
    // ==========================
    ctx.font = "600 34px Arial";
    ctx.fillStyle = "#FDF6D8";
    ctx.letterSpacing = "2px";

    ctx.fillText("INTERNAL TRAINING", 640, y + 70);

    canvas.toBlob((blob) => {
      resolve(
        new File([blob], "thumbnail.png", {
          type: "image/png",
        })
      );
    }, "image/png");
  });
}

function drawDots(ctx, startX, startY) {
  ctx.fillStyle = "rgba(255,255,255,0.65)";

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      ctx.beginPath();
      ctx.arc(startX + c * 22, startY + r * 22, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const test = line + word + " ";

    if (ctx.measureText(test).width > maxWidth) {
      lines.push(line.trim());
      line = word + " ";
    } else {
      line = test;
    }
  });

  lines.push(line.trim());

  return lines;
}
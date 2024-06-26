const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const downloadImage = async (url, filepath) => {
  const response = await axios({
    url,
    responseType: 'stream',
  });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    let error = null;
    writer.on('error', err => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on('close', () => {
      if (!error) {
        resolve(true);
      }
    });
  });
};

app.post('/generate-invoice', async (req, res) => {
  const data = req.body;

  const doc = new PDFDocument({ margin: 50 });
  let buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    let pdfData = Buffer.concat(buffers);
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment;filename=invoice.pdf',
      'Content-Length': pdfData.length
    });
    res.end(pdfData);
  });


  if (data.companyLogo) {
    const logoPath = path.join(__dirname, 'companyLogo.jpg');
    await downloadImage(data.companyLogo, logoPath);
    doc.image(logoPath, 50, 30, { width: 70 }).moveDown();
  }

  // Add Invoice title
  doc.fontSize(25).text('INVOICE', 275, 50);

  // Add Seller Details
  const sellerTop = 100;
  doc.fontSize(12)
     .text(`Seller Name: ${data.sellerName}`, 50, sellerTop)
     .text(`Seller Address: ${data.sellerAddress}`, 50, sellerTop + 15)
     .text(`PAN: ${data.sellerPan}`, 50, sellerTop + 30)
     .text(`GST: ${data.sellerGst}`, 50, sellerTop + 45);

  // Add Billing Details
  doc.text(`Billing Name: ${data.billingName}`, 300, sellerTop)
     .text(`Billing Address: ${data.billingAddress}`, 300, sellerTop + 15);

  // Add Shipping Details
  doc.text(`Shipping Name: ${data.shippingName}`, 300, sellerTop + 30)
     .text(`Shipping Address: ${data.shippingAddress}`, 300, sellerTop + 45);

  // Add Order Details
  const orderTop = sellerTop + 70;
  doc.text(`Order No: ${data.orderNo}`, 50, orderTop)
     .text(`Order Date: ${data.orderDate}`, 50, orderTop + 15)
     .text(`Place of Supply: ${data.placeOfSupply}`, 50, orderTop + 30)
     .text(`Place of Delivery: ${data.placeOfDelivery}`, 50, orderTop + 45);

  // Add Invoice Details
  doc.text(`Invoice No: ${data.invoiceNo}`, 300, orderTop)
     .text(`Invoice Date: ${data.invoiceDate}`, 300, orderTop + 15)
     .text(`Reverse Charge: ${data.reverseCharge}`, 300, orderTop + 30);

  // Add Items Table Header
  const tableTop = orderTop + 70;
  doc.fontSize(10).text("Description", 50, tableTop)
                 .text("Unit Price", 200, tableTop)
                 .text("Quantity", 250, tableTop)
                 .text("Discount", 300, tableTop)
                 .text("Net Amount", 350, tableTop)
                 .text("TaxRate", 410, tableTop)
                 .text("TaxAmount", 450, tableTop)
                 .text("TotalAmount", 505, tableTop);

  // Add Items
  let startY = tableTop + 20;
  data.items.forEach(item => {
   const netAmount = item.unitPrice * item.quantity - item.discount;
   const taxRate = 18; // Fixed tax rate of 18%
   const taxAmount = netAmount * (taxRate / 100);
   const totalAmount = netAmount - taxAmount;

    // Measure text height for dynamic row height
    const textHeight = doc.heightOfString(item.description, { width: 150 });

    // Draw rounded rectangle for each item
    const itemHeight = Math.max(textHeight, 20);
    doc.roundedRect(45, startY - 5, 550, itemHeight + 10, 5).stroke();
    doc.text(item.description, 50, startY, { width: 150 })
       .text(item.unitPrice, 200, startY)
       .text(item.quantity, 250, startY)
       .text(item.discount, 300, startY)
       .text(netAmount.toFixed(2), 350, startY)
       .text(`${taxRate}%`, 410, startY)
       .text(taxAmount.toFixed(2), 455, startY)
       .text(totalAmount.toFixed(2), 515, startY);
    startY += itemHeight + 20;
  });

  // Add Footer
  doc.fontSize(10).text(`Thank you for your business!`, 50, startY + 30, { align: 'center', width: 500 });

  // Add Signature
  if (data.signatureImage) {
    const signaturePath = path.join(__dirname, 'signature.jpg');
    await downloadImage(data.signatureImage, signaturePath);
    doc.image(signaturePath, 40, startY + 20, { width: 150 })
       .text(`${data.sellerName}`, 50, startY + 110)
       .text(`Authorised Signatory`, 50, startY + 125);
  }

  // Finalize the PDF
  doc.end();
});

app.get("/", (req, res) => {
  res.send("invoice generated successfully");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

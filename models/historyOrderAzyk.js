const mongoose = require('mongoose');

const HistoryOrderAzykSchema = mongoose.Schema({
    invoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InvoiceAzyk'
   },
    orders: mongoose.Schema.Types.Mixed,
    editor: String,
}, {
    timestamps: true
});


const HistoryOrderAzyk = mongoose.model('HistoryOrderAzyk', HistoryOrderAzykSchema);

module.exports = HistoryOrderAzyk;
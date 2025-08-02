const mongoose = require('mongoose');

const HistoryStockAzykSchema = mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemAzyk'
   },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrderAzyk'
   },
    count: Number
}, {
    timestamps: true
});


const HistoryStockAzyk = mongoose.model('HistoryStockAzyk', HistoryStockAzykSchema);

module.exports = HistoryStockAzyk;
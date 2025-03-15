const mongoose = require('mongoose');

const StockAzykSchema = mongoose.Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
    },
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemAzyk'
    },
    count: Number
}, {
    timestamps: true
});


const StockAzyk = mongoose.model('StockAzyk', StockAzykSchema);

module.exports = StockAzyk;
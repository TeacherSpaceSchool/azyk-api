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
    warehouse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WarehouseAzyk'
    },
    count: Number
}, {
    timestamps: true
});


const StockAzyk = mongoose.model('StockAzyk', StockAzykSchema);

module.exports = StockAzyk;
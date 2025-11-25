const mongoose = require('mongoose');

const OrderAzykSchema = mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemAzyk'
   },
    count: Number,
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    //количество отказа
    rejected: {
        type: Number,
        default: 0
   },
    allPrice: Number,
    allTonnage: {
        type: Number,
        default: 0
   },
    status: String,
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
   },
    setRoute: {
        type: Boolean,
        default: false
   },
    ads: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdsAzyk'
   },
}, {
    timestamps: true
});

OrderAzykSchema.index({client: 1})
OrderAzykSchema.index({item: 1})
OrderAzykSchema.index({status: 1})

const OrderAzyk = mongoose.model('OrderAzyk', OrderAzykSchema);

module.exports = OrderAzyk;
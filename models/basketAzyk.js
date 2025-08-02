const mongoose = require('mongoose');

const BasketAzykSchema = mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemAzyk'
   },
    count: Number,
    specialPrice: Number,
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
   }
}, {
    timestamps: true
});


const BasketAzyk = mongoose.model('BasketAzyk', BasketAzykSchema);

module.exports = BasketAzyk;
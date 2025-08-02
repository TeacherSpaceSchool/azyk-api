const mongoose = require('mongoose');

const FaqAzykSchema = mongoose.Schema({
    url: String,
    title: String,
    video: String,
    typex:  {
        type: String,
        default: 'клиенты'
   },
    civic:  {
        type: String,
        default: 'клиенты'
   },
}, {
    timestamps: true
});

const FaqAzyk = mongoose.model('FaqAzyk', FaqAzykSchema);

module.exports = FaqAzyk;
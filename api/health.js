module.exports = (req, res) => {
  res.status(200).json({ ok: true, version: '1.2.1' });
};
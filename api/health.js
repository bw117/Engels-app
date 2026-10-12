module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, version: '1.3.0' });
};

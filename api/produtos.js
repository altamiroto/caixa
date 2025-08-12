export default async function handler(req, res) {
  res.status(200).json({
    ACCESS_TOKEN: process.env.ACCESS_TOKEN,
    SECRET_TOKEN: process.env.SECRET_TOKEN
  });
}

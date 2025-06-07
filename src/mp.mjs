import { verifyMessage } from "ethers";

/**
 * 验证 token 并返回地址
 * @param {string} token - 格式为 "address.message.signature" 的 token
 * @returns {string | null} - 验证成功返回地址，失败返回空字符串
 */
export const getAddress = (token) => {
  if (token && typeof token === "string") {
    try {
      const [address, t, sig] = token.toLowerCase().split(".");
      // token 有效期为 24 小时
      if (Date.now() - parseInt(t) > 1000 * 60 * 60 * 24) {
        return null;
      }
      if (address && t && sig) {
        if (address === verifyMessage(t, sig).toLowerCase()) {
          return address;
        }
      }
    } catch (error) {
      console.error("Token验证失败:", error);
    }
  }

  return null;
};

import { HDNodeWallet, getBytes, Mnemonic, pbkdf2, sha256, toUtf8Bytes, hexlify } from 'ethers'
import nacl from 'tweetnacl'

export interface MostWallet {
    username: string
    address: string
    public_key: string
    private_key: string
}

export const mostWallet = (username: string, password: string): MostWallet => {
    const p = toUtf8Bytes(password)
    const salt = toUtf8Bytes('/most.box/' + username)
    const kdf = pbkdf2(p, salt, 3, 32, 'sha512')
    const privateKey = sha256(kdf)

    // x25519 key pair
    const seed = getBytes(privateKey).slice(0, 32)
    const keyPair = nacl.box.keyPair.fromSecretKey(seed)

    const public_key = hexlify(keyPair.publicKey)
    const private_key = hexlify(keyPair.secretKey)

    // wallet all in one
    const mnemonic = Mnemonic.entropyToPhrase(getBytes(privateKey))
    const wallet = HDNodeWallet.fromPhrase(mnemonic)
    const address = wallet.address

    const mostWallet: MostWallet = {
        username,
        address,
        public_key,
        private_key,
    }
    return mostWallet
}

const wallet = mostWallet('most', 'most')
console.log('🌊', wallet)

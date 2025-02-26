import { DotClient } from './DotClient'
import { mostWallet, mostEncode, mostDecode } from './MostWallet'

export type { MostWallet } from './MostWallet'
export type { DotClient, DotMethods } from './DotClient'

const Dot = {
    DotClient,
    mostWallet,
    mostEncode,
    mostDecode,
}

export default Dot

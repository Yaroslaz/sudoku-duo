declare namespace JSX { interface IntrinsicElements { [elemName: string]: any } }
declare module 'react/jsx-runtime' { export const jsx: any; export const jsxs: any; export const Fragment: any; }
declare module 'react' {
  export const StrictMode: any;
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): { current: T };
  export function memo<T>(component: T): T;
}
declare module 'react-dom/client' { export function createRoot(element: any): { render(node: any): void }; }
declare module '@mantine/core' {
  export const ActionIcon: any; export const Alert: any; export const Badge: any; export const Box: any; export const Button: any;
  export const Card: any; export const Container: any; export const CopyButton: any; export const Drawer: any; export const Group: any;
  export const Image: any; export const MantineProvider: any; export const Modal: any; export const Paper: any; export const Progress: any;
  export const SegmentedControl: any; export const SimpleGrid: any; export const Stack: any; export const Text: any; export const Textarea: any;
  export const TextInput: any; export const ThemeIcon: any; export const Title: any; export function createTheme(value: any): any;
}
declare module 'qrcode' { const QRCode: { toDataURL(value: string, options?: any): Promise<string> }; export default QRCode; }
declare module '@zxing/browser' {
  export interface IScannerControls { stop(): void }
  export class BrowserQRCodeReader {
    constructor(hints?: any, options?: any);
    decodeFromConstraints(constraints: any, video: any, callback: (result: { getText(): string } | undefined, error?: any) => void): Promise<IScannerControls>;
  }
}
interface ImportMetaEnv { readonly PROD: boolean }
interface ImportMeta { readonly env: ImportMetaEnv }
declare module 'vite' {
  export type Plugin = {
    name: string;
    apply?: string;
    generateBundle?: (this: { emitFile(file: any): void }, options: any, bundle: Record<string, any>) => void;
  };
  export function defineConfig(value: any): any;
}
declare module '@vitejs/plugin-react' { const react: () => any; export default react; }

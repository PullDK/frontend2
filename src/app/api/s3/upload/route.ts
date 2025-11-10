import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// @ts-ignore
import { extension as getExt } from "mime-types";

const AWS_REGION = process.env.AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const AWS_S3_PUBLIC_BASE_URL = process.env.AWS_S3_PUBLIC_BASE_URL; // opcional (CloudFront/domínio público)
const AWS_S3_SSE = process.env.AWS_S3_SSE || "AES256"; // criptografia do lado do servidor (SSE-S3 por padrão)
const AWS_S3_SSE_KMS_KEY_ID = process.env.AWS_S3_SSE_KMS_KEY_ID; // se usar KMS

function publicUrlForKey(key: string) {
  if (AWS_S3_PUBLIC_BASE_URL) return `${AWS_S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  // Fallback para URL padrão da AWS
  return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

export async function POST(req: Request) {
  try {
    if (!AWS_REGION || !AWS_S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json({ error: "AWS não configurado (.env)" }, { status: 500 });
    }

    const { fileName, contentType, uid } = await req.json();
    if (!fileName || !contentType) {
      return NextResponse.json({ error: "fileName e contentType são obrigatórios" }, { status: 400 });
    }
    const ct = String(contentType);
    const allowed = ct.startsWith("image/") || ct.startsWith("video/") || ct.startsWith("audio/");
    if (!allowed) {
      return NextResponse.json({ error: "Apenas imagem, vídeo ou áudio são permitidos" }, { status: 400 });
    }

    const ext = (getExt(contentType) || fileName.split(".").pop() || "bin").toString();
    const rand = crypto.randomUUID();
    const ts = Date.now();
    const safeUid = typeof uid === "string" && uid.length > 0 ? uid : "anon";
    const key = `uploads/${safeUid}/${ts}-${rand}.${ext}`;

    const s3 = new S3Client({
      region: AWS_REGION,
      credentials: { accessKeyId: AWS_ACCESS_KEY_ID!, secretAccessKey: AWS_SECRET_ACCESS_KEY! },
    });
    const command = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET!,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: AWS_S3_SSE as any,
      ...(AWS_S3_SSE === "aws:kms" && AWS_S3_SSE_KMS_KEY_ID
        ? { SSEKMSKeyId: AWS_S3_SSE_KMS_KEY_ID }
        : {}),
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60s

    const requiredHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "x-amz-server-side-encryption": AWS_S3_SSE,
    };
    if (AWS_S3_SSE === "aws:kms" && AWS_S3_SSE_KMS_KEY_ID) {
      requiredHeaders["x-amz-server-side-encryption-aws-kms-key-id"] = AWS_S3_SSE_KMS_KEY_ID;
    }

    return NextResponse.json(
      { uploadUrl, key, publicUrl: publicUrlForKey(key), requiredHeaders },
      { status: 200 }
    );
  } catch (e: any) {
    const code = e?.name || e?.code || "unknown";
    return NextResponse.json({ error: "Falha ao gerar URL", code }, { status: 500 });
  }
}
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

export default function CertificateVerificationPage() {
  const { certNumber: routeCertNumber } = useParams();
  const [searchParams] = useSearchParams();
  const queryCert = searchParams.get('serial') || searchParams.get('cert') || searchParams.get('code');

  const initialCode = routeCertNumber || queryCert || '';
  const [searchCode, setSearchCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const fetchVerification = async (codeToVerify) => {
    if (!codeToVerify || !codeToVerify.trim()) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      const trimmed = codeToVerify.trim();
      const res = await axios.get(`/api/certificates/verify/${encodeURIComponent(trimmed)}`);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
      } else {
        setError('No certificate found in Egyptian Space Agency records.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Certificate record not found in the Egyptian Space Agency registry or credential code is invalid.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      fetchVerification(initialCode);
    }
  }, [initialCode]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchCode.trim()) {
      fetchVerification(searchCode.trim());
    }
  };

  const formatDate = (d) => {
    if (!d) return 'Official Record';
    try {
      return new Date(d).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return String(d);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#07101E',
        color: '#E2E8F0',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: '2.5rem 1rem 4rem',
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(30, 124, 133, 0.15) 0%, rgba(7, 16, 30, 0.98) 75%)',
      }}
    >
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        {/* Institutional Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              backgroundColor: 'rgba(58, 105, 133, 0.25)',
              border: '2px solid #D4B87C',
              boxShadow: '0 0 25px rgba(212, 184, 124, 0.3)',
              marginBottom: '1.25rem',
            }}
          >
            <i className="fa-solid fa-satellite" style={{ fontSize: '2.4rem', color: '#D4B87C' }}></i>
          </div>

          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              marginBottom: '0.4rem',
              textTransform: 'uppercase',
            }}
          >
            Egyptian Space Agency
          </h1>
          <p
            style={{
              color: '#94A3B8',
              fontSize: '1rem',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '1rem',
            }}
          >
            EgSA Space Academy &bull; Institutional Credential Registry
          </p>

          <div
            style={{
              display: 'inline-block',
              backgroundColor: 'rgba(30, 124, 133, 0.2)',
              border: '1px solid #1E7C85',
              color: '#38BDF8',
              padding: '0.4rem 1.25rem',
              borderRadius: '9999px',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            <i className="fa-solid fa-shield-halved" style={{ marginRight: '0.5rem', color: '#1E7C85' }}></i>
            Official Academic Credential Verification
          </div>
        </div>

        {/* Search Bar Card */}
        <div
          style={{
            backgroundColor: '#0B1528',
            border: '1px solid #1E293B',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            marginBottom: '2rem',
          }}
        >
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <i
                className="fa-solid fa-barcode"
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748B',
                  fontSize: '1.1rem',
                }}
              ></i>
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Enter Certificate Serial (e.g. EGSA-CERT-2026-A1B2C3D4)..."
                id="input-certificate-verify-search"
                style={{
                  width: '100%',
                  padding: '0.85rem 1rem 0.85rem 2.85rem',
                  backgroundColor: '#07101E',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchCode.trim()}
              id="btn-certificate-verify-search"
              style={{
                backgroundColor: '#1E7C85',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                padding: '0.85rem 1.75rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: loading || !searchCode.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !searchCode.trim() ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'background-color 0.2s',
              }}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Verifying...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-magnifying-glass"></i> Verify Credential
                </>
              )}
            </button>
          </form>
        </div>

        {/* Error / Not Found Display */}
        {error && (
          <div
            id="certificate-verify-error"
            style={{
              backgroundColor: 'rgba(223, 79, 76, 0.12)',
              border: '1px solid #DF4F4C',
              borderRadius: '14px',
              padding: '1.5rem',
              color: '#FECACA',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '1.8rem', color: '#DF4F4C' }}></i>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#F87171', marginBottom: '0.2rem' }}>
                Credential Verification Failed
              </div>
              <div style={{ fontSize: '0.92rem' }}>{error}</div>
            </div>
          </div>
        )}

        {/* Verification Success / Result Card */}
        {data && (
          <div
            id="certificate-verify-result-card"
            style={{
              backgroundColor: '#0B1528',
              border: data.isValid ? '2px solid #D4B87C' : '2px solid #DF4F4C',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: data.isValid
                ? '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(212, 184, 124, 0.15)'
                : '0 20px 50px rgba(223, 79, 76, 0.25)',
            }}
          >
            {/* Step 3 Mandated High-Contrast Trust Banner */}
            {data.isValid ? (
              <div
                id="certificate-trust-banner-valid"
                style={{
                  backgroundColor: '#1E7C85',
                  color: '#FFFFFF',
                  padding: '1.1rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  borderBottom: '2px solid #D4B87C',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: '#1E7C85',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '1.2rem',
                    flexShrink: 0,
                  }}
                >
                  <i className="fa-solid fa-check"></i>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>
                    Authentic Academic Credential
                  </div>
                  <div style={{ fontSize: '0.92rem', opacity: 0.95 }}>
                    This certificate is genuine and officially registered in Egyptian Space Agency records.
                  </div>
                </div>
              </div>
            ) : (
              <div
                id="certificate-trust-banner-revoked"
                style={{
                  backgroundColor: '#DF4F4C',
                  color: '#FFFFFF',
                  padding: '1.1rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <i className="fa-solid fa-ban" style={{ fontSize: '1.8rem' }}></i>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Revoked Credential Notice</div>
                  <div style={{ fontSize: '0.92rem' }}>
                    This certificate was officially REVOKED by the Egyptian Space Agency and is no longer valid.
                  </div>
                </div>
              </div>
            )}

            {/* Certificate Metadata Body */}
            <div style={{ padding: '2rem 2.25rem' }}>
              {/* Institutional Top Details */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  borderBottom: '1px solid #1E293B',
                  paddingBottom: '1.5rem',
                  marginBottom: '1.75rem',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#D4B87C',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      display: 'block',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Institutional Credential Serial
                  </span>
                  <div
                    id="verified-cert-number"
                    style={{
                      fontSize: '1.35rem',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      fontFamily: "'Courier New', Courier, monospace",
                      letterSpacing: '0.05em',
                    }}
                  >
                    {data.certificateNumber || data.certificateId}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#94A3B8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      display: 'block',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Registry Status
                  </span>
                  <span
                    id="verified-cert-status"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.35rem 0.9rem',
                      borderRadius: '9999px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      backgroundColor: data.isValid ? 'rgba(30, 124, 133, 0.25)' : 'rgba(223, 79, 76, 0.25)',
                      color: data.isValid ? '#2DD4BF' : '#F87171',
                      border: data.isValid ? '1px solid #1E7C85' : '1px solid #DF4F4C',
                    }}
                  >
                    <i className={data.isValid ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark'}></i>
                    {data.status || (data.isValid ? 'Valid' : 'Revoked')}
                  </span>
                </div>
              </div>

              {/* Core Details Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1.5rem',
                  marginBottom: '2rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Cadet / Student Name
                  </div>
                  <div id="verified-student-name" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF' }}>
                    {data.studentName || data.recipientName}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Training Program / Course
                  </div>
                  <div id="verified-course-title" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38BDF8' }}>
                    {data.courseTitle}
                  </div>
                  {data.courseCode && (
                    <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '0.2rem' }}>
                      Code: {data.courseCode}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Program Cohort
                  </div>
                  <div id="verified-cohort-name" style={{ fontSize: '1.05rem', fontWeight: 600, color: '#CBD5E1' }}>
                    {data.cohortName || 'Main Institutional Cohort'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Date of Official Issuance
                  </div>
                  <div id="verified-issue-date" style={{ fontSize: '1.05rem', fontWeight: 600, color: '#CBD5E1' }}>
                    {formatDate(data.issueDate || data.completionDate)}
                  </div>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Issuing Institutional Authority
                  </div>
                  <div id="verified-issuing-authority" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#D4B87C' }}>
                    {data.issuingAuthority || 'Egyptian Space Agency (EgSA)'}
                  </div>
                </div>
              </div>

              {/* Embedded QR Code & Director Signature Preview */}
              <div
                style={{
                  backgroundColor: '#07101E',
                  border: '1px solid #1E293B',
                  borderRadius: '14px',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1.5rem',
                }}
              >
                {/* Director Signature & Seal Preview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      border: '2px dashed #D4B87C',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(212, 184, 124, 0.08)',
                      color: '#D4B87C',
                      textAlign: 'center',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '4px',
                      lineHeight: 1.2,
                    }}
                  >
                    <i className="fa-solid fa-stamp" style={{ fontSize: '1.1rem', marginBottom: '2px' }}></i>
                    EGSA SEAL
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>
                      Issuing Directorate Signatory
                    </div>
                    <div
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: '#FFFFFF',
                        fontStyle: 'italic',
                        fontFamily: 'serif',
                      }}
                    >
                      Eng. Tarek ElKady
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      Director of Space Academic Affairs &bull; Egyptian Space Agency
                    </div>
                  </div>
                </div>

                {/* Embedded QR Code */}
                {data.qrCode && (
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        padding: '6px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '10px',
                        display: 'inline-block',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                      }}
                    >
                      <img
                        src={data.qrCode}
                        alt="Official Verification QR Code"
                        id="verified-qr-image"
                        style={{ width: '96px', height: '96px', display: 'block' }}
                      />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.35rem' }}>
                      Scan to Authenticate
                    </div>
                  </div>
                )}
              </div>

              {/* Verification Hash */}
              {data.verificationHash && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #1E293B' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Cryptographic Signature Digest:
                  </div>
                  <div
                    style={{
                      fontFamily: "'Courier New', Courier, monospace",
                      fontSize: '0.75rem',
                      color: '#94A3B8',
                      wordBreak: 'break-all',
                    }}
                  >
                    {data.verificationHash}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Back Link */}
        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <Link
            to="/student/certificates"
            style={{
              color: '#94A3B8',
              fontSize: '0.9rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <i className="fa-solid fa-arrow-left"></i> Return to Academy Portal
          </Link>
        </div>
      </div>
    </div>
  );
}

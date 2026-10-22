import React from 'react';
import { Table } from 'react-bootstrap';

export function SimpleTable({ headers = [], children, className = '', hover = true }) {
  return (
    <div className="table-responsive rounded border bg-white shadow-sm">
      <Table hover={hover} className={`mb-0 align-middle ${className}`}>
        {headers && headers.length > 0 && (
          <thead style={{ backgroundColor: '#f8fafc' }}>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="py-2.5 px-3 small text-muted text-uppercase fw-semibold"
                  style={{ fontSize: '0.75rem', letterSpacing: '0.04em' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>{children}</tbody>
      </Table>
    </div>
  );
}

export default SimpleTable;

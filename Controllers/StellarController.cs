using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace rocket_web.Controllers
{
    [Route("api/[controller]")]
    public class StellarController : Controller
    {


        [HttpGet("GetVotes/{pool}")]
        public async Task<IActionResult> GetVotesForPool(string pool)
        {
            //var connString = Configuration["ConnectionString"];
            var connString = "Host=rocketwallet.ceqq1ttingyc.us-west-1.rds.amazonaws.com;Username=RocketPostgresAdmin;Password=UTsFLQw88f644TF;Database=Core_Live";

            decimal Votes = 0;
            using (var conn = new NpgsqlConnection(connString))
            {
                conn.Open();

                // Retrieve all rows
                var cmd = new NpgsqlCommand("SELECT SUM(accounts.balance) FROM accounts WHERE inflationdest = @inflationdest", conn);

                cmd.Parameters.AddWithValue("inflationdest", pool);


                using (var reader = cmd.ExecuteReader())
                    while (reader.Read())
                    {
                        Votes = reader.IsDBNull(0) ? 0 : reader.GetFieldValue<decimal>(0);
                    }

            }
            return Ok(new { Votes = Votes * .0000001m });

        }
    }
}

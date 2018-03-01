using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace rocket_web.Controllers
{
    public class GetPoolVotesRequest
    {
        public string Pool { get; set; }
    }
}
